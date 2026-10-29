import { PastedQuoteInput } from '../types/rfq';

export const SAMPLE_DATA_LABEL = 'Sample data—fictional';

export function createSamplePastedQuotes(): PastedQuoteInput[] {
  return [
    {
      id: 'sample-paste-1',
      label: `Quote 1 — Boreal Flowworks Inc. (${SAMPLE_DATA_LABEL})`,
      text: `[Sample data—fictional]
Supplier: Boreal Flowworks Inc.
Quote #: BFW-4018 | Currency: CAD | Valid Until: 2027-06-30
Lead Time: 2 weeks | Payment Terms: Net 30
Freight: Ex Works (freight not stated) | Handling: Included ($0.00)

Line 1 | CC# 4102 | Veltrix VX-220-SS | 2-way, normally closed, direct acting solenoid valve, 1/2" FNPT, 316 SS body, FKM seals, 24 VDC coil | Qty 4 EA @ $185.00 = $740.00 CAD
Line 2 | CC# 4108 | KovaTech KT-PG100-4L | Liquid-filled pressure gauge, 0-100 psi, 4" dial, 1/4" lower MNPT, 316 SS wetted parts, glycerin fill | Qty 6 EA @ $65.00 = $390.00 CAD
Line 3 | CC# 4115 | StrataFlow SF-610-8 | Inline Y-strainer, 1" FNPT, 316 SS body, 40-mesh 316 SS screen, PTFE cap gasket, 600 WOG | Qty 5 EA @ $92.00 = $460.00 CAD`,
    },
    {
      id: 'sample-paste-2',
      label: `Quote 2 — Cairnstone Valve & Gauge Ltd. (${SAMPLE_DATA_LABEL})`,
      text: `[Sample data—fictional]
Supplier: Cairnstone Valve & Gauge Ltd.
Quote #: CVG-7721 | Currency: CAD | Valid Until: 2027-06-30
Lead Time: 10 business days | Payment Terms: Net 30
Freight: $95.00 CAD (estimated, actual billed) | Handling: Included ($0.00)

Line 1 | CC# 4102 | Veltrix VX-220-SS | 2-way, normally closed, direct acting solenoid valve, 1/2" FNPT, 316 SS body, EPDM seals, 24 VDC coil | Qty 4 EA @ $195.00 = $780.00 CAD
Line 2 | CC# 4108 | KovaTech KT-PG100-4L | Liquid-filled pressure gauge, 0-100 psi, 4" dial, 1/4" lower MNPT, 316 SS wetted parts, glycerin fill | Qty 6 EA @ $68.00 = $408.00 CAD
Line 3 | CC# 4115 | StrataFlow SF-610-8 | Inline Y-strainer, 1" FNPT, 316 SS body, 40-mesh 316 SS screen, PTFE cap gasket, 600 WOG | Qty 5 EA @ $94.00 = $470.00 CAD`,
    },
    {
      id: 'sample-paste-3',
      label: `Quote 3 — Veridian Process Supply Co. (${SAMPLE_DATA_LABEL})`,
      text: `[Sample data—fictional]
Supplier: Veridian Process Supply Co.
Quote #: VPS-9304 | Currency: USD | Valid Until: 2027-06-30
Lead Time: 3 weeks | Payment Terms: Net 45 | Minimum Order: $500.00 USD
Freight: Included (FOB Destination, prepaid & allowed) | Handling: Included ($0.00)

Line 1 | CC# 4102 | Veltrix VX-220-SS | 2-way, normally closed, direct acting solenoid valve, 1/2" FNPT, 316 SS body, FKM seals, 24 VDC coil | Qty 4 EA @ $142.00 USD = $568.00 USD
Line 2 | CC# 4108 | KovaTech KT-PG100-4L | Liquid-filled pressure gauge, 0-100 psi, 4" dial, 1/4" lower MNPT, 316 SS wetted parts, glycerin fill | Qty 6 EA @ $49.00 USD = $294.00 USD
Line 3 | CC# 4115 | StrataFlow SF-610-8 | Inline Y-strainer, 1" FNPT, 316 SS body, 40-mesh 316 SS screen, PTFE cap gasket, 600 WOG | Qty 5 EA @ $72.00 USD = $360.00 USD`,
    },
  ];
}
