export interface Tool {
    name: string;
    description: string;
    parameters: Record<string, any>;
    execute: (args: any) => Promise<any> | any;
}
