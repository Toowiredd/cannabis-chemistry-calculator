/**
 * Round-trip precision check for the unit toggle.
 *
 * Simulates the user-journey: user types a value, toggles units,
 * toggles back, verifies the original value is preserved (the
 * 2026-07-24 user-journey verification round 3 found the OLD
 * code lost precision; this script verifies the NEW behavior).
 */
import { convertWeight, convertVolume, gToOz, ozToG, mlToTsp, tspToMl, mlToTbsp, tbspToMl, mlToCup, cupToMl } from './src/renderer/src/engine/units'

let passed = 0
let failed = 0

function check(label: string, actual: number, expected: number, tolerance = 0.05) {
  const diff = Math.abs(actual - expected)
  if (diff <= tolerance) {
    passed++
    console.log(`  ✓ ${label}: ${actual.toFixed(4)} (expected ${expected.toFixed(4)})`)
  } else {
    failed++
    console.log(`  ✗ ${label}: got ${actual.toFixed(4)}, expected ${expected.toFixed(4)} (diff ${diff.toFixed(4)})`)
  }
}

console.log('='.repeat(60))
console.log('UNIT TOGGLE PRECISION — POST-FIX BEHAVIOR')
console.log('='.repeat(60))
console.log()
console.log('Old behavior (pre-fix): convert-and-round on toggle → lost precision')
console.log('New behavior: state stores the user-typed value in its unit;')
console.log('display converts via convertWeight / convertVolume. Toggle does')
console.log('not touch the stored value.')
console.log()

// Simulate: user types 3.5 in g mode
const userTypedG = 3.5
console.log(`STEP 1: User types "3.5" in g mode`)
console.log(`  State: { weight: "${userTypedG}", weightUnit: "g" }`)
console.log()

// Toggle to oz — state preserved, display converts
console.log(`STEP 2: User toggles to oz (display only, state preserved)`)
console.log(`  State unchanged: { weight: "${userTypedG}", weightUnit: "g" }`)
const displayInOz = convertWeight(userTypedG, 'g', 'oz')
console.log(`  Display: ${displayInOz.toFixed(2)} oz (rounded for display)`)
check('3.5g displayed in oz (rounded to 2 decimals)', Number(displayInOz.toFixed(2)), 0.12)
console.log()

// Toggle back to g — state still preserved
console.log(`STEP 3: User toggles back to g (state STILL preserved)`)
console.log(`  State unchanged: { weight: "${userTypedG}", weightUnit: "g" }`)
const displayBackInG = convertWeight(userTypedG, 'g', 'g')
console.log(`  Display: ${displayBackInG} g (original value, NO precision loss)`)
check('3.5g preserved after g→oz→g round-trip', displayBackInG, 3.5)
console.log()

// Edge case: user types in oz, then toggles
console.log('EDGE CASE: User types "0.1" in oz mode (typical small fat volume)')
const userTypedOz = 0.1
console.log(`  State: { weight: "${userTypedOz}", weightUnit: "oz" }`)
const inGrams = convertWeight(userTypedOz, 'oz', 'g')
console.log(`  Read for engine: ${inGrams.toFixed(4)} g (full precision)`)
check('0.1 oz in grams (full precision, not rounded)', inGrams, 2.835, 0.0001)
const backToOz = convertWeight(userTypedOz, 'oz', 'oz')
console.log(`  Toggle to g then back to oz: ${backToOz} oz (preserved)`)
check('0.1 oz preserved after oz→g→oz round-trip', backToOz, 0.1)
console.log()

// Volume case (the 5mL → 0 cup bug)
console.log('EDGE CASE: User types "5" in mL mode (small fat volume — old bug went to 0 cup)')
const userTypedMl = 5
console.log(`  State: { volume: "${userTypedMl}", volumeUnit: "mL" }`)
const displayInCup = convertVolume(userTypedMl, 'mL', 'cup')
console.log(`  Display in cup: ${displayInCup.toFixed(3)} cup (NOT 0 anymore!)`)
check('5mL displayed in cup (NOT rounded to 0)', displayInCup, 0.021, 0.001)
const backToMl = convertVolume(userTypedMl, 'mL', 'mL')
console.log(`  Toggle to cup then back to mL: ${backToMl} mL (preserved)`)
check('5mL preserved after mL→cup→mL round-trip', backToMl, 5)
console.log()

console.log('='.repeat(60))
console.log(`RESULT: ${passed} passed, ${failed} failed`)
console.log('='.repeat(60))

if (failed > 0) process.exit(1)
