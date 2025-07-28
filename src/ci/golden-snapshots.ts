/**
 * Golden Output Snapshots
 * 
 * Freeze current parser results as test fixtures to ensure exact compatibility
 * between legacy and modern implementations.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Interface for snapshot data
export interface Snapshot {
  name: string;
  input: {
    csvContent: string;
    config: any;
  };
  output: {
    data: any[];
    errors: any[];
    meta: any;
  };
  checksum: string;
  timestamp: string;
  version: string;
}

// Interface for snapshot comparison results
export interface SnapshotComparison {
  passed: boolean;
  differences: {
    path: string;
    expected: any;
    actual: any;
  }[];
  summary: string;
}

/**
 * Golden Snapshots Manager
 */
export class GoldenSnapshots {
  private snapshotDir: string;
  private snapshots: Map<string, Snapshot> = new Map();

  constructor(snapshotDir: string = 'src/ci/snapshots') {
    this.snapshotDir = path.resolve(snapshotDir);
    this.ensureSnapshotDir();
    this.loadExistingSnapshots();
  }

  /**
   * Ensure snapshot directory exists
   */
  private ensureSnapshotDir(): void {
    if (!fs.existsSync(this.snapshotDir)) {
      fs.mkdirSync(this.snapshotDir, { recursive: true });
    }
  }

  /**
   * Load existing snapshots from disk
   */
  private loadExistingSnapshots(): void {
    if (!fs.existsSync(this.snapshotDir)) {
      return;
    }

    const files = fs.readdirSync(this.snapshotDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(this.snapshotDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const snapshot: Snapshot = JSON.parse(content);
          this.snapshots.set(snapshot.name, snapshot);
        } catch (error) {
          console.warn(`Failed to load snapshot ${file}:`, error);
        }
      }
    }
  }

  /**
   * Generate checksum for consistency verification
   */
  private generateChecksum(data: any): string {
    const serialized = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Create a snapshot from parser output
   */
  createSnapshot(
    name: string,
    csvContent: string,
    config: any,
    parseResult: any,
    version: string = '1.0.0'
  ): Snapshot {
    const snapshot: Snapshot = {
      name,
      input: {
        csvContent,
        config: this.sanitizeConfig(config)
      },
      output: {
        data: parseResult.data,
        errors: parseResult.errors,
        meta: parseResult.meta
      },
      checksum: this.generateChecksum(parseResult),
      timestamp: new Date().toISOString(),
      version
    };

    this.snapshots.set(name, snapshot);
    this.saveSnapshot(snapshot);
    return snapshot;
  }

  /**
   * Sanitize config for consistent snapshots (remove functions, etc.)
   */
  private sanitizeConfig(config: any): any {
    const sanitized = { ...config };
    
    // Remove functions as they can't be serialized consistently
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'function') {
        sanitized[key] = '[Function]';
      }
    }
    
    return sanitized;
  }

  /**
   * Save snapshot to disk
   */
  private saveSnapshot(snapshot: Snapshot): void {
    const filename = `${snapshot.name}.json`;
    const filePath = path.join(this.snapshotDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  }

  /**
   * Compare a parse result against a snapshot
   */
  compareWithSnapshot(name: string, parseResult: any): SnapshotComparison {
    const snapshot = this.snapshots.get(name);
    if (!snapshot) {
      return {
        passed: false,
        differences: [{ path: 'snapshot', expected: 'exists', actual: 'not found' }],
        summary: `Snapshot '${name}' not found`
      };
    }

    const differences = this.deepCompare('', snapshot.output, parseResult);
    const passed = differences.length === 0;

    return {
      passed,
      differences,
      summary: passed 
        ? `Snapshot '${name}' matches perfectly`
        : `Snapshot '${name}' has ${differences.length} differences`
    };
  }

  /**
   * Deep comparison of two objects
   */
  private deepCompare(path: string, expected: any, actual: any): Array<{ path: string; expected: any; actual: any }> {
    const differences: Array<{ path: string; expected: any; actual: any }> = [];

    if (typeof expected !== typeof actual) {
      differences.push({ path, expected, actual });
      return differences;
    }

    if (expected === null || actual === null) {
      if (expected !== actual) {
        differences.push({ path, expected, actual });
      }
      return differences;
    }

    if (typeof expected === 'object') {
      if (Array.isArray(expected) !== Array.isArray(actual)) {
        differences.push({ path, expected, actual });
        return differences;
      }

      if (Array.isArray(expected)) {
        if (expected.length !== actual.length) {
          differences.push({ 
            path: `${path}.length`, 
            expected: expected.length, 
            actual: actual.length 
          });
        }

        const minLength = Math.min(expected.length, actual.length);
        for (let i = 0; i < minLength; i++) {
          const itemPath = path ? `${path}[${i}]` : `[${i}]`;
          differences.push(...this.deepCompare(itemPath, expected[i], actual[i]));
        }
      } else {
        const expectedKeys = Object.keys(expected).sort();
        const actualKeys = Object.keys(actual).sort();

        // Check for missing or extra keys
        for (const key of expectedKeys) {
          if (!(key in actual)) {
            differences.push({ 
              path: path ? `${path}.${key}` : key, 
              expected: expected[key], 
              actual: undefined 
            });
          }
        }

        for (const key of actualKeys) {
          if (!(key in expected)) {
            differences.push({ 
              path: path ? `${path}.${key}` : key, 
              expected: undefined, 
              actual: actual[key] 
            });
          }
        }

        // Compare common keys
        for (const key of expectedKeys) {
          if (key in actual) {
            const keyPath = path ? `${path}.${key}` : key;
            differences.push(...this.deepCompare(keyPath, expected[key], actual[key]));
          }
        }
      }
    } else if (expected !== actual) {
      differences.push({ path, expected, actual });
    }

    return differences;
  }

  /**
   * Generate standard test snapshots from legacy implementation
   */
  generateStandardSnapshots(legacyParser: any): void {
    console.log('Generating standard snapshots from legacy implementation...');

    const testCases = [
      {
        name: 'simple_csv',
        csvContent: 'name,age,city\nJohn,30,NYC\nJane,25,LA',
        config: { header: true }
      },
      {
        name: 'dynamic_typing',
        csvContent: 'name,age,active,score\nJohn,30,true,95.5\nJane,25,false,87.2',
        config: { header: true, dynamicTyping: true }
      },
      {
        name: 'quoted_fields',
        csvContent: 'name,message\n"John Doe","Hello, world!"\n"Jane Smith","Say ""hello"""',
        config: { header: true }
      },
      {
        name: 'empty_fields',
        csvContent: 'a,b,c\n1,,3\n,2,\n,,',
        config: { header: true }
      },
      {
        name: 'line_breaks_in_quotes',
        csvContent: 'name,description\nProduct A,"Line 1\nLine 2\nLine 3"\nProduct B,Simple',
        config: { header: true }
      },
      {
        name: 'comments',
        csvContent: '# This is a comment\nname,age\n# Another comment\nJohn,30\nJane,25',
        config: { header: true, comments: '#' }
      },
      {
        name: 'skip_empty_lines',
        csvContent: 'name,age\n\nJohn,30\n\n\nJane,25\n',
        config: { header: true, skipEmptyLines: true }
      },
      {
        name: 'custom_delimiter',
        csvContent: 'name|age|city\nJohn|30|NYC\nJane|25|LA',
        config: { header: true, delimiter: '|' }
      },
      {
        name: 'unicode_content',
        csvContent: 'name,emoji,description\nJohn,🚀,"Space enthusiast"\nJane,🎨,"Artistic soul"',
        config: { header: true }
      },
      {
        name: 'edge_case_empty',
        csvContent: '',
        config: {}
      }
    ];

    for (const testCase of testCases) {
      try {
        const result = legacyParser.parse(testCase.csvContent, testCase.config);
        this.createSnapshot(testCase.name, testCase.csvContent, testCase.config, result);
        console.log(`✅ Created snapshot: ${testCase.name}`);
      } catch (error) {
        console.error(`❌ Failed to create snapshot ${testCase.name}:`, error);
      }
    }

    console.log(`Generated ${testCases.length} standard snapshots`);
  }

  /**
   * Validate all snapshots against a parser implementation
   */
  validateAllSnapshots(parser: any): {
    passed: boolean;
    results: Map<string, SnapshotComparison>;
    summary: {
      total: number;
      passed: number;
      failed: number;
    };
  } {
    console.log('Validating all snapshots...');
    
    const results = new Map<string, SnapshotComparison>();
    let passedCount = 0;

    for (const [name, snapshot] of this.snapshots) {
      try {
        const parseResult = parser.parse(snapshot.input.csvContent, snapshot.input.config);
        const comparison = this.compareWithSnapshot(name, parseResult);
        results.set(name, comparison);
        
        if (comparison.passed) {
          passedCount++;
          console.log(`✅ ${name}: PASSED`);
        } else {
          console.log(`❌ ${name}: FAILED - ${comparison.summary}`);
          for (const diff of comparison.differences.slice(0, 3)) { // Show first 3 differences
            console.log(`   ${diff.path}: expected ${JSON.stringify(diff.expected)}, got ${JSON.stringify(diff.actual)}`);
          }
          if (comparison.differences.length > 3) {
            console.log(`   ... and ${comparison.differences.length - 3} more differences`);
          }
        }
      } catch (error) {
        const comparison: SnapshotComparison = {
          passed: false,
          differences: [{ path: 'error', expected: 'no error', actual: error }],
          summary: `Parse error: ${error}`
        };
        results.set(name, comparison);
        console.log(`❌ ${name}: ERROR - ${error}`);
      }
    }

    const total = this.snapshots.size;
    const failed = total - passedCount;
    const passed = failed === 0;

    return {
      passed,
      results,
      summary: {
        total,
        passed: passedCount,
        failed
      }
    };
  }

  /**
   * Get list of all snapshot names
   */
  getSnapshotNames(): string[] {
    return Array.from(this.snapshots.keys());
  }

  /**
   * Get a specific snapshot
   */
  getSnapshot(name: string): Snapshot | undefined {
    return this.snapshots.get(name);
  }
}

// CLI runner for generating and validating snapshots
export async function runSnapshotGeneration(): Promise<void> {
  console.log('🔍 Generating Golden Snapshots...');
  
  const snapshots = new GoldenSnapshots();
  
  try {
    // Import legacy implementation
    const legacyPapa = require('../../legacy/papaparse.js');
    
    // Generate standard snapshots
    snapshots.generateStandardSnapshots(legacyPapa);
    
    console.log('✅ Golden snapshots generated successfully');
  } catch (error) {
    console.error('❌ Failed to generate snapshots:', error);
    process.exit(1);
  }
}

export async function runSnapshotValidation(): Promise<void> {
  console.log('🔍 Validating Golden Snapshots...');
  
  const snapshots = new GoldenSnapshots();
  
  try {
    // Import both implementations
    const legacyPapa = require('../../legacy/papaparse.js');
    // const modernPapa = require('../../dist/index.js'); // Modern implementation when ready
    
    // Validate legacy (should always pass)
    console.log('\nValidating legacy implementation:');
    const legacyValidation = snapshots.validateAllSnapshots(legacyPapa);
    
    if (!legacyValidation.passed) {
      console.error('❌ Legacy validation failed - snapshots may be corrupted');
      process.exit(1);
    }
    
    console.log('✅ Legacy validation passed');
    
    // When modern implementation is ready:
    // console.log('\nValidating modern implementation:');
    // const modernValidation = snapshots.validateAllSnapshots(modernPapa);
    
    // if (!modernValidation.passed) {
    //   console.error('❌ Modern implementation failed snapshot validation');
    //   process.exit(1);
    // }
    
    console.log('✅ All snapshot validations passed');
  } catch (error) {
    console.error('❌ Snapshot validation failed:', error);
    process.exit(1);
  }
}

export default GoldenSnapshots;
