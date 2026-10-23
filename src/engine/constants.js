/** Public architecture. Other geometry is explicitly educational, not maintenance data. */
export const GE90 = Object.freeze({
  model: 'GE90–115B',
  aircraft: 'Boeing 777–300ER',
  fanBlades: 22,
  fanDiameterInches: 128,
  fanRadius: 1.6256,
  boosterStages: 4,
  compressorStages: 9,
  hptStages: 2,
  lptStages: 6,
  referenceThrustKN: 512.87,
});
export const TAU = Math.PI * 2;
export const MODULES = [
  {
    id: 'exterior',
    name: 'Exterior assembly',
    short: 'Exterior',
    purpose:
      'The inlet, acoustic lining and nacelle guide incoming air and enclose the bypass path.',
    relationship:
      'Stationary structure around the fan and core. The outer duct carries bypass air to its own nozzle.',
    material: 'Graphite / titanium',
    move: [0, 2.8, -2.4],
  },
  {
    id: 'fan',
    name: 'Fan module',
    short: 'Fan',
    purpose:
      'Twenty-two swept composite blades accelerate a large mass of air. Most of that air travels around the core.',
    relationship:
      'Directly connected to the low-pressure shaft and six-stage LP turbine; no reduction gearbox.',
    material: 'Carbon composite / titanium',
    move: [-2.4, 0, 0],
    spool: 'LP',
  },
  {
    id: 'booster',
    name: 'Low-pressure compressor',
    short: 'Booster',
    purpose: 'Four booster stages compress the portion of fan air entering the engine core.',
    relationship: 'Rotors turn with the fan and LP turbine. Interleaved stators remain fixed.',
    material: 'Titanium alloy',
    move: [-1.2, 0, 0],
    spool: 'LP',
    stages: 4,
  },
  {
    id: 'hpc',
    name: 'High-pressure compressor',
    short: 'HP compressor',
    purpose: 'Nine axial stages progressively raise the pressure of the core airflow.',
    relationship:
      'The high-pressure shaft couples these rotors to the two-stage HP turbine. Front stators can change incidence.',
    material: 'Titanium / nickel alloys',
    move: [0.2, 0, 0],
    spool: 'HP',
    stages: 9,
  },
  {
    id: 'combustor',
    name: 'Combustion system',
    short: 'Combustor',
    purpose:
      'Fuel burns continuously inside an annular liner. Cooling and dilution air protect the liner and shape the turbine inlet flow.',
    relationship: 'Stationary between the compressor diffuser and HP turbine nozzle guide vanes.',
    material: 'Heat-resistant nickel alloy',
    move: [1.8, 0, 0],
  },
  {
    id: 'hpt',
    name: 'High-pressure turbine',
    short: 'HP turbine',
    purpose:
      'Two turbine stages extract energy from the hot core stream to drive the high-pressure compressor.',
    relationship:
      'Shares the HP spool with the nine-stage compressor. Nozzle guide vanes direct gas onto the rotors.',
    material: 'Nickel superalloy / ceramic',
    move: [3.0, 0, 0],
    spool: 'HP',
    stages: 2,
  },
  {
    id: 'lpt',
    name: 'Low-pressure turbine',
    short: 'LP turbine',
    purpose:
      'Six turbine stages recover more gas energy to drive the large fan and four-stage booster.',
    relationship: 'Connected to the fan through the inner, concentric low-pressure shaft.',
    material: 'Nickel superalloy',
    move: [4.5, 0, 0],
    spool: 'LP',
    stages: 6,
  },
  {
    id: 'shafts',
    name: 'Shafts & bearings',
    short: 'Shafts',
    purpose:
      'Two concentric shaft systems transmit torque while bearings locate and support the rotating assemblies.',
    relationship:
      'The inner LP shaft runs through the hollow HP shaft. The two spools turn independently.',
    material: 'High-strength steel',
    move: [0, 0, 2.8],
  },
  {
    id: 'aux',
    name: 'Auxiliary systems',
    short: 'Accessories',
    purpose:
      'A representative accessory gearbox, starter, oil system, control unit and harness serve the engine.',
    relationship:
      'Accessory routing and hardware are illustrative; external line segments terminate at fittings.',
    material: 'Aluminium / steel / polymer',
    move: [0, -0.15, 2.4],
  },
  {
    id: 'stand',
    name: 'Display stand',
    short: 'Stand',
    purpose:
      'A minimal maintenance-style cradle makes the heavy engine legible as a physical object.',
    relationship:
      'Educational exhibit furniture; not a certified GE transport or maintenance fixture.',
    material: 'Painted structural steel',
    move: [0, -0.15, 0],
    required: false,
  },
];
