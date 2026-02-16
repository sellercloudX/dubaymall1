import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, Database, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ParsedMxikRecord {
  code: string;
  name_uz: string;
  name_ru?: string;
  group_name?: string;
  group_code?: string;
  unit_name?: string;
  unit_code?: string;
  vat_rate?: number;
}

// Normalize column headers for flexible matching
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s]+/g, ' ')
    .trim();
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const normalizedHeaders = headers.map(h => h ? normalizeColumnName(String(h)) : '');
  const normalizedNames = possibleNames.map(normalizeColumnName);

  // Exact match
  for (const name of normalizedNames) {
    const idx = normalizedHeaders.indexOf(name);
    if (idx !== -1) return idx;
  }
  // Starts with
  for (const name of normalizedNames) {
    const idx = normalizedHeaders.findIndex(h => h.startsWith(name));
    if (idx !== -1) return idx;
  }
  // Contains
  for (const name of normalizedNames) {
    const idx = normalizedHeaders.findIndex(h => h.includes(name));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function MxikImport() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ inserted: number; errors: number; total: number } | null>(null);
  const [parsedCount, setParsedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseExcelFile = async (file: File): Promise<ParsedMxikRecord[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rows.length < 2) throw new Error('Excel fayl bo\'sh yoki noto\'g\'ri formatda');

    // Find header row (first row with recognizable headers)
    let headerRowIndex = 0;
    let headers: string[] = [];

    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i].map(cell => String(cell || ''));
      const hasCode = row.some(c => normalizeColumnName(c).includes('mxik') || normalizeColumnName(c).includes('ikpu') || normalizeColumnName(c).includes('kod'));
      const hasName = row.some(c => normalizeColumnName(c).includes('nom') || normalizeColumnName(c).includes('name') || normalizeColumnName(c).includes('наименование'));
      if (hasCode || hasName) {
        headerRowIndex = i;
        headers = row;
        break;
      }
    }

    if (headers.length === 0) {
      // Try first row as headers
      headers = rows[0].map(cell => String(cell || ''));
      headerRowIndex = 0;
    }

    console.log('Headers found:', headers);

    // Map columns
    const codeCol = findColumnIndex(headers, ['mxik kod', 'mxik code', 'kod mxik', 'mxik', 'ikpu', 'code', 'код', 'mxik kodi']);
    const nameUzCol = findColumnIndex(headers, ['nomi', 'nom', 'name_uz', 'mahsulot nomi', 'наименование на узбекском', 'tovar nomi', 'name']);
    const nameRuCol = findColumnIndex(headers, ['name_ru', 'наименование', 'название', 'ruscha nomi', 'наименование на русском']);
    const groupCol = findColumnIndex(headers, ['guruh', 'group', 'группа', 'group_name', 'kategoriya', 'категория']);
    const vatCol = findColumnIndex(headers, ['qqs', 'vat', 'ндс', 'vat_rate', 'qqs stavka']);

    console.log(`Column mapping: code=${codeCol}, nameUz=${nameUzCol}, nameRu=${nameRuCol}, group=${groupCol}, vat=${vatCol}`);

    // If no code column found, try to detect by content (17-digit numbers)
    let effectiveCodeCol = codeCol;
    if (effectiveCodeCol === -1) {
      for (let col = 0; col < (rows[headerRowIndex + 1]?.length || 0); col++) {
        const val = String(rows[headerRowIndex + 1][col] || '');
        if (/^\d{5,17}$/.test(val.trim())) {
          effectiveCodeCol = col;
          console.log(`Detected code column by content at index ${col}`);
          break;
        }
      }
    }

    if (effectiveCodeCol === -1) {
      throw new Error('MXIK kod ustuni topilmadi. Excel faylda "MXIK kod" yoki "Kod" ustuni bo\'lishi kerak.');
    }

    const records: ParsedMxikRecord[] = [];

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      const code = String(row[effectiveCodeCol] || '').trim();

      if (!code || code.length < 5) continue;

      // Pad code to 17 digits if needed
      const paddedCode = code.length < 17 ? code.padEnd(17, '0') : code;

      const nameUz = nameUzCol >= 0 ? String(row[nameUzCol] || '').trim() : '';
      const nameRu = nameRuCol >= 0 ? String(row[nameRuCol] || '').trim() : '';
      const group = groupCol >= 0 ? String(row[groupCol] || '').trim() : '';
      const vat = vatCol >= 0 ? parseFloat(String(row[vatCol] || '12')) : 12;

      if (!nameUz && !nameRu) continue;

      records.push({
        code: paddedCode,
        name_uz: nameUz || nameRu || code,
        name_ru: nameRu || undefined,
        group_name: group || undefined,
        vat_rate: isNaN(vat) ? 12 : vat,
      });
    }

    return records;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setProgress(10);
    setResult(null);

    try {
      // Parse Excel
      toast.info('Excel fayl o\'qilmoqda...');
      const records = await parseExcelFile(file);
      setParsedCount(records.length);
      setProgress(40);

      if (records.length === 0) {
        toast.error('Excel fayldan MXIK kodlar topilmadi');
        return;
      }

      toast.info(`${records.length} ta MXIK kod topildi, bazaga yuklanmoqda...`);

      // Send to edge function in batches
      const batchSize = 2000;
      let totalInserted = 0;
      let totalErrors = 0;

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { data, error } = await supabase.functions.invoke('import-mxik-codes', {
          body: {
            records: batch,
            clearExisting: i === 0, // Only clear on first batch
          },
        });

        if (error) {
          console.error('Import batch error:', error);
          totalErrors += batch.length;
        } else {
          totalInserted += data?.inserted || 0;
          totalErrors += data?.errors || 0;
        }

        setProgress(40 + Math.round((i / records.length) * 55));
      }

      setProgress(100);
      setResult({ inserted: totalInserted, errors: totalErrors, total: records.length });
      toast.success(`${totalInserted} ta MXIK kod muvaffaqiyatli yuklandi!`);
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Import xatosi');
    } finally {
      setIsLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          MXIK Kodlar Bazasi
        </CardTitle>
        <CardDescription>
          Excel fayldan MXIK kodlarni bazaga yuklang. Keyin barcha MXIK qidiruvlar shu bazadan ishlaydi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isLoading}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={isLoading}
            variant="outline"
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Excel faylni tanlash
          </Button>
          <Badge variant="secondary" className="gap-1">
            <FileSpreadsheet className="h-3 w-3" />
            .xlsx, .xls, .csv
          </Badge>
        </div>

        {isLoading && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">
              {progress < 40 ? 'Excel fayl o\'qilmoqda...' :
               progress < 95 ? `Bazaga yuklanmoqda... (${parsedCount} ta kod)` :
               'Yakunlanmoqda...'}
            </p>
          </div>
        )}

        {result && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
              {result.errors === 0 ? (
                <CheckCircle className="h-5 w-5 text-primary" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              <span className="font-medium">Import natijasi</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Jami</p>
                <p className="font-mono font-bold">{result.total}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Yuklandi</p>
                <p className="font-mono font-bold text-primary">{result.inserted}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Xatolar</p>
                <p className={`font-mono font-bold ${result.errors > 0 ? 'text-destructive' : ''}`}>{result.errors}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
