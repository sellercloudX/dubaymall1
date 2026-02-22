import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, Database, CheckCircle, AlertCircle, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';

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

function findColumnByContent(rows: any[][], startRow: number, test: (val: string) => boolean): number {
  const samplesToCheck = Math.min(10, rows.length - startRow);
  for (let col = 0; col < (rows[startRow]?.length || 0); col++) {
    let matches = 0;
    for (let r = startRow; r < startRow + samplesToCheck; r++) {
      if (!rows[r]) continue;
      const val = String(rows[r][col] || '').trim();
      if (val && test(val)) matches++;
    }
    if (matches >= Math.max(1, samplesToCheck * 0.3)) return col;
  }
  return -1;
}

async function parseExcelData(arrayBuffer: ArrayBuffer): Promise<ParsedMxikRecord[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel fayl bo\'sh');

  // Convert ExcelJS worksheet to row arrays
  const rows: any[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values: any[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      // Pad with empty strings for missing columns
      while (values.length < colNumber - 1) values.push('');
      values.push(cell.value != null ? String(cell.value) : '');
    });
    rows.push(values);
  });

  if (rows.length < 2) throw new Error('Excel fayl bo\'sh');

  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i].map(cell => String(cell || ''));
    const normalized = row.map(normalizeColumnName);
    const hasCodeHeader = normalized.some(c =>
      c.includes('mxik') || c.includes('ikpu') || c.includes('kod') || c.includes('code') || c.includes('код')
    );
    const hasNameHeader = normalized.some(c =>
      c.includes('nom') || c.includes('name') || c.includes('наименование') || c.includes('название') || c.includes('tovar')
    );
    if (hasCodeHeader || hasNameHeader) {
      headerRowIndex = i;
      headers = row;
      break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    headers = rows[0].map(cell => String(cell || ''));
  }

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
    'guruh', 'group', 'группа', 'group_name', 'kategoriya', 'категория'
  ]);
  const vatCol = findColumnIndex(headers, [
    'qqs', 'vat', 'ндс', 'vat_rate', 'qqs stavka'
  ]);

  const dataStartRow = headerRowIndex + 1;

  if (codeCol === -1) {
    codeCol = findColumnByContent(rows, dataStartRow, (val) => {
      const cleaned = val.replace(/\s/g, '');
      return /^\d{5,17}$/.test(cleaned);
    });
  }

  if (nameUzCol === -1 && nameRuCol === -1) {
    for (let col = 0; col < (rows[dataStartRow]?.length || 0); col++) {
      if (col === codeCol || col === groupCol || col === vatCol) continue;
      let textCount = 0;
      const samplesToCheck = Math.min(5, rows.length - dataStartRow);
      for (let r = dataStartRow; r < dataStartRow + samplesToCheck; r++) {
        const val = String(rows[r]?.[col] || '').trim();
        if (val.length > 3 && !/^\d+([.,]\d+)?$/.test(val)) textCount++;
      }
      if (textCount >= Math.max(1, samplesToCheck * 0.5)) {
        if (nameUzCol === -1) { nameUzCol = col; }
        else if (nameRuCol === -1 && col !== nameUzCol) { nameRuCol = col; break; }
      }
    }
  }

  if (codeCol === -1) throw new Error('MXIK kod ustuni topilmadi');

  const records: ParsedMxikRecord[] = [];
  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    let code = String(row[codeCol] || '').trim().replace(/\s/g, '');
    if (!code || !/^\d+$/.test(code)) continue;
    if (code.length < 17) code = code.padEnd(17, '0');
    if (code.length > 17) code = code.substring(0, 17);

    const nameUz = nameUzCol >= 0 ? String(row[nameUzCol] || '').trim() : '';
    const nameRu = nameRuCol >= 0 ? String(row[nameRuCol] || '').trim() : '';
    const group = groupCol >= 0 ? String(row[groupCol] || '').trim() : '';
    const vat = vatCol >= 0 ? parseFloat(String(row[vatCol] || '12')) : 12;

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
}

async function uploadRecords(records: ParsedMxikRecord[], onProgress: (p: number) => void): Promise<{ inserted: number; errors: number }> {
  const batchSize = 2000;
  let totalInserted = 0;
  let totalErrors = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { data, error } = await supabase.functions.invoke('import-mxik-codes', {
      body: { records: batch, clearExisting: i === 0 },
    });

    if (error) {
      totalErrors += batch.length;
    } else {
      totalInserted += data?.inserted || 0;
      totalErrors += data?.errors || 0;
    }
    onProgress(40 + Math.round((i / records.length) * 55));
  }

  return { inserted: totalInserted, errors: totalErrors };
}

export function MxikImport() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ inserted: number; errors: number; total: number } | null>(null);
  const [dbCount, setDbCount] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Check current DB count on mount
  useEffect(() => {
    supabase.from('mxik_codes').select('id', { count: 'exact', head: true }).then(({ count }) => {
      setDbCount(count ?? 0);
    });
  }, [result]);

  const loadBuiltInExcel = async () => {
    setIsLoading(true);
    setProgress(10);
    setResult(null);

    try {
      toast.info('SellerCloudX bazasi yuklanmoqda...');
      const response = await fetch('/data/MXIK_kod011.xlsx');
      if (!response.ok) throw new Error('Fayl topilmadi');

      const arrayBuffer = await response.arrayBuffer();
      setProgress(30);

      const records = await parseExcelData(arrayBuffer);
      setProgress(40);

      if (records.length === 0) {
        toast.error('Fayldan kodlar topilmadi');
        setIsLoading(false);
        return;
      }

      toast.info(`${records.length} ta kod topildi, bazaga yuklanmoqda...`);

      const { inserted, errors } = await uploadRecords(records, setProgress);
      setProgress(100);
      setResult({ inserted, errors, total: records.length });

      if (inserted > 0) {
        toast.success(`${inserted} ta MXIK kod bazaga yuklandi!`);
      } else {
        toast.error('Kodlar yuklanmadi');
      }
    } catch (error: any) {
      console.error('Load error:', error);
      toast.error(error.message || 'Xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setProgress(10);
    setResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      setProgress(30);
      const records = await parseExcelData(arrayBuffer);
      setProgress(40);

      if (records.length === 0) {
        toast.error('Fayldan kodlar topilmadi');
        setIsLoading(false);
        return;
      }

      toast.info(`${records.length} ta kod topildi`);
      const { inserted, errors } = await uploadRecords(records, setProgress);
      setProgress(100);
      setResult({ inserted, errors, total: records.length });

      if (inserted > 0) toast.success(`${inserted} ta MXIK kod yuklandi!`);
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Xatolik');
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
          SellerCloudX tizimida barcha hamkorlar uchun yagona MXIK bazasi. Bir marta yuklansa, hamma foydalanadi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current DB status */}
        <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {dbCount && dbCount > 100 ? (
              <CheckCircle className="h-5 w-5 text-primary" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive" />
            )}
            <span className="text-sm">
              Bazada: <strong className="font-mono">{dbCount ?? '...'}</strong> ta MXIK kod
            </span>
          </div>
          {dbCount !== null && dbCount < 500 && (
            <Badge variant="destructive">Baza to'ldirilmagan</Badge>
          )}
        </div>

        {/* Main action: load built-in Excel */}
        <Button
          onClick={loadBuiltInExcel}
          disabled={isLoading}
          className="w-full gap-2"
          size="lg"
        >
          {isLoading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Database className="h-4 w-4" />
          )}
          SellerCloudX bazasini yuklash (o'rnatilgan Excel)
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">yoki</span>
          </div>
        </div>

        {/* Custom file upload */}
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleCustomUpload}
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
            Boshqa Excel faylni yuklash
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
              {progress < 40 ? 'Fayl o\'qilmoqda...' :
               progress < 95 ? 'Bazaga yuklanmoqda...' :
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
              <span className="font-medium">Natija</span>
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
