# Canadian Retirement Locked-In Accounts Plan

Last updated: 2026-03-30

## 1. Why This Matters

Locked-in pension money is common in Canada and cannot be treated like a normal RRSP or RRIF.

If the calculator ignores `LIRA / LIF / FRV` rules, it will misstate:

- how much cash is actually available,
- when locked-in money can start,
- minimum and maximum withdrawals,
- one-time unlocking options,
- spouse and survivor constraints.

## 2. Official Rule Anchors Reviewed

### Ontario

- FSRA guidance on Ontario LIF / LRIF maximum annual income payment tables says Ontario LIF maximum payment rules are harmonized and calculated under Regulation 909.
- FSRA Form 5.2 and its 2026 guide confirm a `Schedule 1.1 LIF` can allow a one-time withdrawal or transfer of up to `50%` of the amount transferred into the LIF, and the application must be received within `60 days` of the transfer.
- FSRA non-hardship unlocking guidance confirms additional categories like shortened life expectancy, small-balance unlocking tied to `40% of YMPE` at age `55+`, excess transfer above Income Tax Act limits, and non-residency.

### British Columbia

- BCFSA states a BC LIF can start as early as age `50`.
- BCFSA states the `CRA sets the minimum annual withdrawal` and the `PBSR sets the maximum`.
- BCFSA also states the BC LIF maximum varies with `age`, `long-term interest rates`, and the fund's `previous-year investment return`.

### Alberta

- Alberta's pensions information for individuals confirms locked-in funds can move from a pension plan to a `LIRA`, and from there to a `LIF`.
- Alberta's guidance confirms five unlocking paths from a `LIRA` or `LIF`: shortened life, non-residency, small amount, `50% unlocking`, and financial hardship.
- Alberta Interpretive Guideline `IG-18` describes a LIF as a RRIF with a prescribed addendum, generally available starting at age `50`, with annual withdrawals constrained by the Act and Regulation.

### Quebec

- Retraite Quebec distinguishes `CRI` and `FRV` from other provinces' LIRA / LIF structures.
- Retraite Quebec's FRV tools show Quebec maximums are not a simple single-factor rule. They depend on FRV-specific calculations and can include temporary income logic.
- Conclusion: Quebec `FRV` should be treated as its own module, not as a small variation of Ontario / BC / Alberta LIF logic.

## 3. Product Implications

### Shared behavior we can model together

- locked-in balances are not freely withdrawable before conversion,
- conversion typically starts around retirement age,
- minimum withdrawals often track or relate closely to RRIF-style minimum rules,
- unlocking is jurisdiction-specific and should be explicit, not assumed.

### Behavior that must stay jurisdiction-specific

- annual `maximum` withdrawal formulas,
- eligibility age and special exceptions,
- one-time `50% unlocking` mechanics,
- spouse / pension-partner waiver requirements,
- Quebec FRV temporary-income logic.

## 4. Recommended MVP Scope

### MVP-Core

Support these paths first:

- `ON LIF`
- `BC LIF`
- `AB LIF`
- `QC FRV` as warning-heavy partial support only

### MVP-Core engine behavior

1. Keep `LIRA` as non-drawable before conversion.
2. Allow conversion from `LIRA` to `LIF` only once retirement income starts.
3. Apply CRA-style minimum withdrawal floor after conversion.
4. Add province-specific `maximum withdrawal` support for `ON`, `BC`, and `AB`.
5. Treat Quebec `FRV` as partial-support only until a dedicated module exists.
6. Model one-time `50% unlocking` as an explicit input event, not an automatic assumption.

## 5. Recommended Input Design

Add fields like:

- `lockedInJurisdiction`: `ON | BC | AB | QC | other`
- `lockedInAccountType`: `LIRA | LIF | CRI | FRV`
- `lifStartAge`
- `lifEstablished`
- `usedFiftyPercentUnlocking`
- `initialUnlockedAmount`
- `pensionPartnerWaiverCompleted`
- `financialInstitutionCalculatedMaximumOverride`

Rationale:

- the user may already know their institution-calculated max,
- province formulas can be complex,
- manual override is necessary for trust and auditability.

## 6. Recommended Calculation Strategy

### Phase 1

- Use the current annual engine.
- Add a locked-in account sub-ledger.
- Add minimum / maximum guardrails for `ON`, `BC`, and `AB`.
- If requested withdrawal exceeds maximum, cap it and raise a warning.

### Phase 2

- Add province-specific formula tables and annual market-rate parameters.
- Add unlocking events and spouse-waiver gating.
- Add more detailed transfer paths between `LIRA`, `LIF`, `RRSP`, `RRIF`, and unlocked cash.

### Phase 3

- Add a dedicated Quebec `FRV` module.
- Add death-year treatment for locked-in accounts.
- Add institution override support and audit traces.

## 7. Recommended Build Order

1. Extend types for locked-in jurisdiction and account subtype.
2. Add a locked-in rules document per province.
3. Implement `LIRA -> LIF` conversion.
4. Implement `ON / BC / AB` minimum / maximum withdrawal caps.
5. Add `50% unlocking` input support.
6. Deepen Quebec FRV modeling, especially younger-case temporary-income logic.

## 8. Current Recommendation

Do not silently treat `LIF` like `RRIF`.

Current engine status:

- baseline `LIRA -> LIF` conversion now exists,
- baseline `ON / BC / AB` minimum / maximum guardrails now exist,
- Quebec `FRV` now recognizes the 2025+ no-maximum rule for ages 55 and older, while younger temporary-income logic remains partial,
- manual annual min / max overrides are still preferred when available.

Medium-term:

- make locked-in accounts a first-class engine concept.
