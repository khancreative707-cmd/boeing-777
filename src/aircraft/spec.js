/** Public 777-300ER envelope; internal arrangement and removal geometry are educational. */
export const AIRCRAFT = Object.freeze({
  model: 'Boeing 777–300ER',
  length: 73.86,
  span: 64.8,
  height: 18.5,
  fuselageDiameter: 6.2,
  engineModel: 'GE90–115B',
  fanBlades: 22,
  passengerDoors: 10,
  mainWheels: 12,
  noseWheels: 2,
});
export const AIRCRAFT_TOUR = [
  {
    id: 'aircraft',
    title: 'One aircraft, connected systems',
    text: 'Explore a long-range twin-engine widebody. Select a component or step through the structure, cabin and mechanisms.',
  },
  {
    id: 'aircraft.fuselage',
    title: 'A pressure vessel with a floor',
    text: 'Skin, circumferential frames and longitudinal members form the fuselage. The passenger floor separates the cabin from the lower cargo compartments.',
  },
  {
    id: 'aircraft.cabin',
    title: 'Two aisles inside the structure',
    text: 'A representative two-class interior sits above the cargo deck. Seats, bins, partitions and service modules retain individual identities.',
  },
  {
    id: 'aircraft.wings.left',
    title: 'An airfoil built around a wing box',
    text: 'Spars and ribs support the swept wing. Slats, flaps, spoilers and ailerons change the shape or loading of the lifting surface.',
  },
  {
    id: 'aircraft.gear.left',
    title: 'Six wheels share the load',
    text: 'Each main gear has a six-wheel truck. Doors, braces and actuators follow a sequenced educational retraction cycle. Maintenance supports engage first.',
  },
  {
    id: 'aircraft.engines.left',
    title: 'Two independent engine systems',
    text: 'Each GE90 has its own low- and high-pressure spools. Enter engine inspection to explore the existing detailed fan, compressor, combustor and turbines.',
  },
  {
    id: 'aircraft.cockpit',
    title: 'Controls report the same model',
    text: 'The gear indication, thrust levers and engine readouts reflect the exhibit state. Unimplemented instruments are passive representations.',
  },
  {
    id: 'aircraft.systems',
    title: 'Connections make the aircraft work',
    text: 'Representative hydraulic lines, electrical harnesses and air ducts connect equipment with supported routes and terminals. Exact routing is illustrative.',
  },
];
export const AIRCRAFT_VIEWS = {
  Exterior: { position: [-74, 32, 72], target: [0, 5, 0] },
  Front: { position: [-124, 22, 0], target: [0, 5, 0] },
  Side: { position: [-5, 24, 128], target: [0, 5, 0] },
  Top: { position: [0, 148, 0.1], target: [0, 5, 0] },
  Underside: { position: [-58, -32, 90], target: [0, 5, 0] },
  Cabin: { position: [-18, 15, 25], target: [-9, 6, 0] },
  Cockpit: { position: [-26.2, 10.8, 6.8], target: [-31.8, 6.8, 0] },
  Cargo: { position: [-3, 5, 23], target: [-3, 4.4, 0] },
  Exploded: { position: [-98, 50, 110], target: [0, 8, 0] },
  Orbit: { position: [-74, 32, 72], target: [0, 5, 0] },
};
