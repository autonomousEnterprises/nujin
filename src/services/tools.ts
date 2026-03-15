import * as vm from 'vm';
import { logger } from './logger.js';

/**
 * Executes dynamic Javascript code in a sandboxed V8 context
 * @param code The Javascript code string 
 * @param args Arguments to pass to the code
 * @returns The resolved result from the code execution
 */
export async function executeDynamicTool(code: string, args: Record<string, any> = {}): Promise<any> {
  logger.info({ args }, 'Executing skill code');
  try {
    // The sandbox environment exposing safe globals
    const sandbox = {
      args,          // The arguments passed from the AI
      console,       // Let skills log if needed
      fetch,         // Expose fetch for HTTP requests
      result: null,  // Variable to store the return value
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      Buffer,
      process: { env: process.env } // Optionally expose env config safely
    };

    // Create a context out of the sandbox
    const context = vm.createContext(sandbox);

    // Wrap the code in an async IIFE so we can handle await safely and
    // assign the result to the sandbox.result and wait for it
    const wrappedCode = `
      (async function main() {
        try {
          ${code}
          
          // If the code doesn't explicitly set standard result, try to capture value
          // e.g. tool might just do:
          // result = await fetch(...);
        } catch(e) {
          throw e;
        }
      })();
    `;

    // Execute the code
    const script = new vm.Script(wrappedCode);
    await script.runInContext(context, { timeout: 10000 }); // 10s timeout

    logger.info({ result: context.result }, 'Skill execution result');
    // We can also have skills assign to `result` 
    return context.result;
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'Error executing skill code');
    return `Error executing skill: ${error.message}`;
  }
}
