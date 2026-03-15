export interface BuiltinTool {
    name: string;
    description: string;
    parameters: Record<string, any>;
    execute: (args: any, context?: any) => Promise<any> | any;
}
