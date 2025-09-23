declare module 'csv-writer' {
  export interface CsvWriter<T = any> {
    writeRecords(records: T[]): Promise<void>;
  }

  export function createObjectCsvWriter(options: {
    path: string;
    header: Array<{ id: string; title: string }>;
    append?: boolean;
    alwaysQuote?: boolean;
  }): CsvWriter<Record<string, any>>;
}
