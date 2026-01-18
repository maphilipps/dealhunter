declare module 'simple-wappalyzer' {
  interface WappalyzerTechnology {
    name: string;
    categories: string[];
    version?: string;
    confidence: number;
    website?: string;
    icon?: string;
  }

  interface WappalyzerInput {
    url: string;
    headers?: Record<string, string>;
    html?: string;
    cookies?: Record<string, string>;
    scripts?: string[];
    meta?: Record<string, string>;
  }

  function wappalyzer(input: WappalyzerInput): WappalyzerTechnology[];

  export default wappalyzer;
}
