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
      fetch: (...fetchArgs: any[]) => (fetch as any)(...fetchArgs), // Safe fetch binding
      result: undefined,  // Variable to store the return value
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      Buffer,
    };

    // Create a context out of the sandbox
    const context = vm.createContext(sandbox);

    // Wrap the code in an async function and return the logic result
    const wrappedCode = `
      (async function main() {
        try {
          return await (async () => {
            ${code}
          })();
        } catch(e) {
          throw e;
        }
      })();
    `;

    // Execute the code
    const script = new vm.Script(wrappedCode);
    
    // vm.Script timeout only tracks CPU time, not wall clock (like fetch)
    // So we await the promise returned by the async IIFE
    const executionPromise = script.runInContext(context, { timeout: 10000 });

    // Race against a wall-clock timeout for network requests etc
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Skill execution timed out (Wall Clock)')), 10000)
    );

    const returnedValue = await Promise.race([executionPromise, timeoutPromise]);

    // Priority: context.result (explicit assignment) > returnedValue (standard return)
    const finalResult = context.result !== undefined ? context.result : returnedValue;

    logger.info({ result: finalResult }, 'Skill execution result');
    return finalResult;
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'Error executing skill code');
    return `Error executing skill: ${error.message}`;
  }
}
