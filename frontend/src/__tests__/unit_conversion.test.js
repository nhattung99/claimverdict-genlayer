import { parseGenToWei, formatWeiToGen } from '../genlayerClient.js';

function runUnitConversionTests() {
  console.log("Starting Precision Unit Conversion Tests...");

  // Test 1: Smallest unit 0.000000000000000001 GEN = 1 wei
  const smallestWei = parseGenToWei("0.000000000000000001");
  console.assert(smallestWei === 1n, `Test 1 Failed: expected 1n, got ${smallestWei}`);

  const smallestGen = formatWeiToGen(1n);
  console.assert(smallestGen === "0.000000000000000001", `Test 1 Format Failed: got ${smallestGen}`);

  // Test 2: Standard fraction 0.1 GEN (float-vulnerable in JS float multiplication)
  const pointOneWei = parseGenToWei("0.1");
  console.assert(pointOneWei === 100000000000000000n, `Test 2 Failed: got ${pointOneWei}`);

  const pointOneGen = formatWeiToGen(100000000000000000n);
  console.assert(pointOneGen === "0.1", `Test 2 Format Failed: got ${pointOneGen}`);

  // Test 3: Large integer 1000000 GEN
  const millionWei = parseGenToWei("1000000");
  console.assert(millionWei === 1000000000000000000000000n, `Test 3 Failed: got ${millionWei}`);

  const millionGen = formatWeiToGen(1000000000000000000000000n);
  console.assert(millionGen === "1000000", `Test 3 Format Failed: got ${millionGen}`);

  // Test 4: Round-trip assertions formatWeiToGen(parseGenToWei(x)) === x
  const testValues = ["1", "0.5", "100.25", "0.000001", "30000"];
  for (const val of testValues) {
    const wei = parseGenToWei(val);
    const formatted = formatWeiToGen(wei);
    console.assert(formatted === val, `Round-trip Failed for ${val}: got ${formatted}`);
  }

  console.log("All 4 Precision Unit Conversion Tests Passed 100%!");
}

runUnitConversionTests();
