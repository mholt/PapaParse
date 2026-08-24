# Changelog

## 5.6.0

### Features

- Remove the optional jQuery plugin integration (#1137)

## 5.5.5

### Bug Fixes

- Improve automatic delimiter detection by prioritizing row consistency over field count (#1128, #1077)
- Serialize dates with `Date.toISOString()`, preserving expanded years and writing invalid dates as empty fields (#1140)

## 5.5.4

### Bug Fixes

- Strip the byte order mark (BOM) from header column names
- Correctly quote and escape custom quote characters when unparsing (#1124, #1068)

### Maintenance

- Update supported Node.js versions in CI (#1097)
- Document `Papa.BYTE_ORDER_MARK` (#1096)
- Add regression coverage for `renamedHeaders` with duplicate headers (#1024, #1102)
- Use HTTPS for README links (#1104)

## 5.5.3

### Bug Fixes

- Avoid infinite loop with duplicate header counting (#1095)

## 5.5.2

### Bug Fixes

- Only attempt to parse headers once, fixing performance issue (#1086)

### Maintenance

- Do not run headless tests on CI (#1087)
- Fix package URL in package.json

## 5.5.1

### Maintenance

- Revert "Remove ES6 features to allow minifying papaparse file" — updated `grunt-contrib-uglify` instead to support ES6+
- Update grunt-contrib-uglify version
- Run build script in CI

## 5.5.0

### Features

- Add `skipFirstNLines` option to skip first N lines before parsing (#1021, #738)
- Add `renamedHeaders` to parse result meta, reporting original-to-renamed header mappings (#990)

### Bug Fixes

- Fix `escapeFormulae` option to handle boolean values correctly (#1025)
- Fix cursor position when encountering duplicated headers (#997)
- Only skip first N lines in the first chunk and don't incorrectly consume the header line (#1045, #1046)
- Refactor header renaming logic to correctly handle duplicates (#1058, #1052, #1007)

### Performance

- Faster duplicate header detection using a header map (#991)
- Use `for` loop instead of `for...in` for header parsing to only iterate over array elements (#987)

### Maintenance

- Update minimum ES version to 6
- Documentation and README improvements (#1002, #1034, #1041, #1044, #1060)

## 5.4.1

### Bug Fixes

- Remove jsperf.com links from README.md. (#986)
- Only test duplicate headers on first row
- Rename duplicated headers
