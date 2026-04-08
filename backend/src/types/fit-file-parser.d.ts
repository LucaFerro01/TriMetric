declare module 'fit-file-parser' {
  interface FitParserOptions {
    force?: boolean;
    speedUnit?: string;
    lengthUnit?: string;
    temperatureUnit?: string;
    elapsedRecordField?: boolean;
  }
  class FitParser {
    constructor(options?: FitParserOptions);
    parse(content: Buffer | string, callback: (error: Error | null, data: Record<string, unknown>) => void): void;
  }
  export default FitParser;
}
