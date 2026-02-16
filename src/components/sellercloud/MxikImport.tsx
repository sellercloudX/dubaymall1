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

function normalizeColumnName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s]+/g, ' ')
    .trim();
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const normalizedHeaders = headers.map(h => normalizeColumnName(h));
  const normalizedNames = possibleNames.map(normalizeColumnName);

  for (const name of normalizedNames) {
    const idx = normalizedHeaders.indexOf(name);
    if (idx !== -1) return idx;
  }
  for (const name of normalizedNames) {
    const idx = normalizedHeaders.findIndex(h => h.startsWith(name));
    if (idx !== -1) return idx;
  }
  for (const name of normalizedNames) {
    const idx = normalizedHeaders.findIndex(h => h.includes(name));
    if (idx !== -1) return idx;
  }
  return -1;
}

// Detect column by scanning data rows for patterns
function findColumnByContent(rows: any[][], startRow: number, test: (val: string) => boolean): number {
  const samplesToCheck = Math.min(10, rows.length - startRow);
  for (let col = 0; col < (rows[startRow]?.length || 0); col++) {
    let matches = 0;
    for (let r = startRow; r < startRow + samplesToCheck; r++) {
      if (!rows[r]) continue;
      const val = String(rows[r][col] || '').trim();
      if (val && test(val)) matches++;
    }
    // If at least 50% of sampled rows match, this is likely our column
    if (matches >= Math.max(1, samplesToCheck * 0.3)) return col;
  }
  return -1;
}

export function MxikImport() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ inserted: number; errors: number; total: number } | null>(null);
  const [parsedCount, setParsedCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const parseExcelFile = async (file: File): Promise<ParsedMxikRecord[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Log all sheet names
    console.log('Sheet names:', workbook.SheetNames);
    
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    console.log(`Total rows: ${rows.length}`);
    console.log('First 3 rows:', JSON.stringify(rows.slice(0, 3)));

    if (rows.length < 2) throw new Error('Excel fayl bo\'sh yoki noto\'g\'ri formatda');

    // Find header row - check first 10 rows
    let headerRowIndex = -1;
    let headers: string[] = [];

    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i].map(cell => String(cell || ''));
      const normalized = row.map(normalizeColumnName);
      
      // Check if this row looks like headers (has text, not numbers)
      const hasTextCells = normalized.filter(c => c.length > 1 && !/^\d+$/.test(c)).length >= 2;
      const hasCodeHeader = normalized.some(c => 
        c.includes('mxik') || c.includes('ikpu') || c.includes('kod') || c.includes('code') || c.includes('код')
      );
      const hasNameHeader = normalized.some(c => 
        c.includes('nom') || c.includes('name') || c.includes('наименование') || c.includes('название') || c.includes('tovar')
      );
      
      if (hasCodeHeader || hasNameHeader || (hasTextCells && i === 0)) {
        headerRowIndex = i;
        headers = row;
        break;
      }
    }

    // Fallback: use first row
    if (headerRowIndex === -1) {
      headerRowIndex = 0;
      headers = rows[0].map(cell => String(cell || ''));
    }

    const debugHeaders = `Headers (row ${headerRowIndex}): ${headers.join(' | ')}`;
    console.log(debugHeaders);
    setDebugInfo(debugHeaders);

    // Map columns by header names
    let codeCol = findColumnIndex(headers, [
      'mxik kod', 'mxik code', 'kod mxik', 'mxik', 'ikpu', 'code', 'код', 
      'mxik kodi', 'классификатор', 'ikpu kod', 'ikpu kodi', 'mxik(ikpu)',
      'mxik (ikpu)', 'mxik/ikpu', 'commodity code'
    ]);
    let nameUzCol = findColumnIndex(headers, [
      'nomi', 'nom', 'name_uz', 'mahsulot nomi', 'tovar nomi', 'name',
      'наименование на узбекском', 'o\'zbek tilida', 'uzbek nomi', 'описание'
    ]);
    let nameRuCol = findColumnIndex(headers, [
      'name_ru', 'наименование', 'название', 'ruscha nomi', 'наименование на русском',
      'rus tilida', 'russian name', 'описание на русском'
    ]);
    const groupCol = findColumnIndex(headers, [
      'guruh', 'group', 'группа', 'group_name', 'kategoriya', 'категория', 'sinf', 'класс'
    ]);
    const vatCol = findColumnIndex(headers, [
      'qqs', 'vat', 'ндс', 'vat_rate', 'qqs stavka', 'soliq', 'налог'
    ]);

    console.log(`Column mapping: code=${codeCol}, nameUz=${nameUzCol}, nameRu=${nameRuCol}, group=${groupCol}, vat=${vatCol}`);

    const dataStartRow = headerRowIndex + 1;

    // Content-based detection for MXIK code column (numbers 5-17 digits)
    if (codeCol === -1) {
      codeCol = findColumnByContent(rows, dataStartRow, (val) => {
        const cleaned = val.replace(/\s/g, '');
        return /^\d{5,17}$/.test(cleaned);
      });
      if (codeCol !== -1) console.log(`Auto-detected code column at index ${codeCol} by content`);
    }

    // Content-based detection for name column (text strings > 3 chars, not pure numbers)
    if (nameUzCol === -1 && nameRuCol === -1) {
      // Find columns with text (not numbers, not the code column)
      for (let col = 0; col < (rows[dataStartRow]?.length || 0); col++) {
        if (col === codeCol || col === groupCol || col === vatCol) continue;
        let textCount = 0;
        const samplesToCheck = Math.min(5, rows.length - dataStartRow);
        for (let r = dataStartRow; r < dataStartRow + samplesToCheck; r++) {
          const val = String(rows[r]?.[col] || '').trim();
          if (val.length > 3 && !/^\d+([.,]\d+)?$/.test(val)) textCount++;
        }
        if (textCount >= Math.max(1, samplesToCheck * 0.5)) {
          if (nameUzCol === -1) {
            nameUzCol = col;
            console.log(`Auto-detected name column at index ${col} by content`);
          } else if (nameRuCol === -1 && col !== nameUzCol) {
            nameRuCol = col;
            console.log(`Auto-detected name_ru column at index ${col} by content`);
            break;
          }
        }
      }
    }

    if (codeCol === -1 && nameUzCol === -1) {
      throw new Error(`Ustunlar topilmadi. Sarlavhalar: ${headers.join(', ')}`);
    }

    // If we have no code column but have names, we can still import with generated placeholder
    if (codeCol === -1) {
      throw new Error(`MXIK kod ustuni topilmadi. Sarlavhalar: ${headers.join(', ')}`);
    }

    const records: ParsedMxikRecord[] = [];

    for (let i = dataStartRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // Get code - handle both string and number formats
      let code = String(row[codeCol] || '').trim().replace(/\s/g, '');
      
      // Skip empty or non-numeric codes
      if (!code || !/^\d+$/.test(code)) continue;
      
      // Pad code to 17 digits if needed
      if (code.length < 17) code = code.padEnd(17, '0');
      // Truncate if too long
      if (code.length > 17) code = code.substring(0, 17);

      const nameUz = nameUzCol >= 0 ? String(row[nameUzCol] || '').trim() : '';
      const nameRu = nameRuCol >= 0 ? String(row[nameRuCol] || '').trim() : '';
      const group = groupCol >= 0 ? String(row[groupCol] || '').trim() : '';
      const vat = vatCol >= 0 ? parseFloat(String(row[vatCol] || '12')) : 12;

      // Must have at least a name
      if (!nameUz && !nameRu) continue;

      records.push({
        code,
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
    setDebugInfo('');

    try {
      toast.info('Excel fayl o\'qilmoqda...');
      const records = await parseExcelFile(file);
      setParsedCount(records.length);
      setProgress(40);

      if (records.length === 0) {
        toast.error('Excel fayldan MXIK kodlar topilmadi. Konsolda batafsil ma\'lumot.');
        setIsLoading(false);
        return;
      }

      toast.info(`${records.length} ta MXIK kod topildi, bazaga yuklanmoqda...`);

      const batchSize = 2000;
      let totalInserted = 0;
      let totalErrors = 0;

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { data, error } = await supabase.functions.invoke('import-mxik-codes', {
          body: {
            records: batch,
            clearExisting: i === 0,
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
      
      if (totalInserted > 0) {
        toast.success(`${totalInserted} ta MXIK kod muvaffaqiyatli yuklandi!`);
      } else {
        toast.error('Hech qanday kod yuklanmadi. Xatolarni tekshiring.');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Import xatosi');
      setDebugInfo(prev => prev + '\n' + (error.message || ''));
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

        {debugInfo && (
          <div className="rounded-md bg-muted p-3 text-xs font-mono break-all text-muted-foreground">
            {debugInfo}
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
