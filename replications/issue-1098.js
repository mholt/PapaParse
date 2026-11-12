/**
 * Bug Replication for Issue #1098: transformHeader renaming and ignoring not working as expected
 * https://github.com/mholt/PapaParse/issues/1098
 *
 * This script demonstrates the bug where using transformHeader to both rename headers and ignore
 * columns by returning null causes all headers to be renamed to null.
 *
 * FINDINGS:
 * - The bug is more severe than originally reported - it causes a TypeError crash
 * - The crash occurs because stripBom() in papaparse.js tries to call charCodeAt() on null
 * - The transformHeader function is called multiple times on the same headers
 * - Even the workaround of returning empty string doesn't work properly
 * - The issue affects both object-based header mapping and array-based header filtering
 */

const Papa = require('../papaparse.js');

// Sample CSV data with multiple columns
const csvData = `Code Set,Code Name,Code Value,description,extra_column1,extra_column2
CS001,Test Code,TC123,This is a test code,Extra Data 1,Extra Data 2
CS002,Another Code,AC456,Another test code,More Extra,Even More Extra
CS003,Third Code,TC789,Third test code,Additional,Additional Data`;

console.log('Issue #1098 Replication Script');
console.log('==============================\n');

// Header mapping as described in the issue
const headerMap = {
	'Code Set': 'codeSet',
	'Code Name': 'codeName',
	'Code Value': 'codeValue',
};

// Test Case 1: Working case - renaming headers but keeping unmapped ones
console.log('Test Case 1: Renaming headers (keeping unmapped headers) - WORKING');
console.log('-------------------------------------------------------------------');
const config1 = {
	header: true,
	skipEmptyLines: true,
	transformHeader: (header) => {
		if (header in headerMap) {
			console.log(`  Transforming "${header}" to "${headerMap[header]}"`);
			return headerMap[header];
		}
		console.log(`  Keeping header "${header}" as is`);
		return header;
	}
};

const result1 = Papa.parse(csvData, config1);
console.log('\nParsed data (first row):');
console.log(JSON.stringify(result1.data[0], null, 2));
console.log(`\nTotal rows parsed: ${result1.data.length}`);
console.log('\n');

// Test Case 2: Broken case - trying to ignore unmapped headers by returning null
console.log('Test Case 2: Renaming headers and ignoring unmapped (returning null) - BROKEN');
console.log('------------------------------------------------------------------------------');
const config2 = {
	header: true,
	skipEmptyLines: true,
	transformHeader: (header) => {
		if (header in headerMap) {
			console.log(`  Transforming "${header}" to "${headerMap[header]}"`);
			return headerMap[header];
		}
		console.log(`  Returning null for header "${header}"`);
		return null;
	}
};

try {
	const result2 = Papa.parse(csvData, config2);
	console.log('\nParsed data (first row):');
	console.log(JSON.stringify(result2.data[0], null, 2));
	console.log(`\nTotal rows parsed: ${result2.data.length}`);
} catch (error) {
	console.log('\nERROR: ' + error.message);
	console.log('Stack trace:', error.stack.split('\n').slice(0, 5).join('\n'));
}
console.log('\n');

// Test Case 3: Using array of headers without renaming (mentioned as working in the issue)
console.log('Test Case 3: Using array of headers without renaming - TESTING');
console.log('---------------------------------------------------------------');
const validHeaders = ['Code Set', 'Code Name', 'Code Value'];
const config3 = {
	header: true,
	skipEmptyLines: true,
	transformHeader: (header) => {
		if (validHeaders.includes(header)) {
			console.log(`  Keeping header "${header}"`);
			return header;
		}
		console.log(`  Returning null for header "${header}"`);
		return null;
	}
};

try {
	const result3 = Papa.parse(csvData, config3);
	console.log('\nParsed data (first row):');
	console.log(JSON.stringify(result3.data[0], null, 2));
	console.log(`\nTotal rows parsed: ${result3.data.length}`);
} catch (error) {
	console.log('\nERROR: ' + error.message);
	console.log('Stack trace:', error.stack.split('\n').slice(0, 5).join('\n'));
}
console.log('\n');

// Test Case 4: Potential workaround - returning empty string instead of null
console.log('Test Case 4: Workaround - returning empty string instead of null');
console.log('-----------------------------------------------------------------');
const config4 = {
	header: true,
	skipEmptyLines: true,
	transformHeader: (header) => {
		if (header in headerMap) {
			console.log(`  Transforming "${header}" to "${headerMap[header]}"`);
			return headerMap[header];
		}
		console.log(`  Returning empty string for header "${header}"`);
		return '';  // Return empty string instead of null
	}
};

try {
	const result4 = Papa.parse(csvData, config4);
	console.log('\nParsed data (first row):');
	console.log(JSON.stringify(result4.data[0], null, 2));
	console.log(`\nTotal rows parsed: ${result4.data.length}`);
} catch (error) {
	console.log('\nERROR: ' + error.message);
	console.log('Stack trace:', error.stack.split('\n').slice(0, 5).join('\n'));
}
console.log('\n');

// Summary
console.log('SUMMARY');
console.log('=======');
console.log('\nExpected behavior:');
console.log('- Test Case 1: Headers should be renamed according to headerMap, unmapped headers kept as is');
console.log('- Test Case 2: Headers should be renamed according to headerMap, unmapped headers should be ignored/removed');
console.log('- Test Case 3: Headers in validHeaders array should be kept, others should be ignored/removed');
console.log('- Test Case 4: Workaround test - using empty string instead of null');
console.log('\nActual behavior:');
console.log('- Test Case 1: Works as expected');
console.log('- Test Case 2: BUG - Causes TypeError when trying to process null headers');
console.log('- Test Case 3: Same issue - TypeError when returning null');
console.log('- Test Case 4: Check if empty string works as a workaround');
