import { useState } from 'react';

const MANUFACTURERS = [
  'Honda', 'Yamaha', 'KTM', 'Kawasaki', 'Suzuki', 'Husqvarna', 'GasGas', 'Beta', 'Sherco', 'TM Racing',
  'Stark Future', 'Fantic', 'Sur-Ron', 'Kayo', 'Osset', 'Triumph', 'Universal', 'Other'
];

const MODELS = {
  Honda: [
    'CRF450R','CRF450RWE','CRF250R','CRF250RWE','CRF450RX','CRF250RX','CRF450X','CRF250F','CRF125F','CRF110F','CRF50F',
  ],
  Yamaha: [
    'YZ450F','YZ250F','YZ250','YZ125','YZ450FX','YZ250FX','WR450F','WR250F','TT-R230','TT-R125LE','TT-R110E','TT-R50E','PW50','YZ65','YZ85',
  ],
  KTM: [
    '450 SX-F','350 SX-F','250 SX-F','300 SX','250 SX','125 SX','85 SX','65 SX','50 SX','450 XC-F','350 XC-F','250 XC-F','300 XC','250 XC',
  ],
  Kawasaki: [
    'KX450','KX250','KX112','KX85','KX65','KX450X','KX250X','KLX300R','KLX230R','KLX140R','KLX110R',
  ],
  Suzuki: [
    'RM-Z450','RM-Z250','DR-Z125L','DR-Z50','RM-250','RM-125','RM-85',
  ],
  Husqvarna: [
    'FC 450','FC 350','FC 250','TC 300','TC 250','TC 125','TC 85','TC 65','TC 50','TE 300','FE 350','FE 501','FE 450','FE 350','FE 250','TE 300','TE 250','TE 150','TE 125',
  ],
  GasGas: [
    'MC 450F','MC 250F','MC 250','MC 125','MC 85','MC 65','MC 50','EC 500F','EC 350F','EC 300.','EX 300',
  ],
  Beta: [
    'RX 350','RX 250','RX 450','125 RR Race','200 RR Race','250 RR Race','300 RR Race','350 RR Race','390 RR Race','430 RR Race','480 RR Race',
  ],
  Sherco: [
    '125 SE Factory','250 SE Factory','300 SE Factory','4-Stroke Models','250 SEF Factory','300 SEF Factory','450 SEF Factory','500 SEF Factory','250 SE Xtrem',
  ],
  'TM Racing': [
    'EN 125 Fi','EN 144 Fi','EN 250 Fi','EN 300 Fi','EN 250Fi','EN 300Fi','EN 450Fi','MX 85','MX 125','MX 144','MX 250','MX 300','MX 250Fi','MX 300Fi','MX 450Fi',
  ],
  'Stark Future': [
    'VARG MX','VARG EX',
  ],
  Fantic: [
    'XEF 450','XEF 310','XEF 250','XE 300','XE 125','XEF 125','XE 50','XXF 450','XXF 250','XX 250','XX 125',
  ],
  'Sur-Ron': [
    'Light Bee X','Light Bee L1E','Light Bee S','Ultra Bee','Ultra Bee T','Ultra Bee R','Storm Bee F','Storm Bee E','Storm Bee R',
  ],
  Osset: [
    'TXP-24','TXP-20','TXP-16','TXP-12',
  ],
  Triumph: [
    'TF 450-X','TF 250-X','TF 250-C','TF 450-C','TF 250-E','TF 450-E',
  ],
};

const DIRT_BIKE_PARTS_CATEGORIES = [
  'Bars & Controls',
  'Body Parts & Accessories',
  'Bolts & Hardware',
  'Brakes',
  'Cooling Systems',
  'Drive',
  'Electrical',
  'Engine',
  'Exhaust',
  'Foot Controls',
  'Fuel System',
  'Intake',
  'Lighting',
  'Suspension',
  'Wheels and Tyres',
];

export default function SellerPartsSubmissionForm() {
  const [manufacturer, setManufacturer] = useState('');
  const [otherManufacturer, setOtherManufacturer] = useState('');
  const [model, setModel] = useState('');

  return (
    <form className="space-y-6">
      <div>
        <label className="block font-semibold mb-1">Product Name</label>
        <input className="w-full border rounded px-3 py-2" required />
      </div>
      <div>
        <label className="block font-semibold mb-1">Price</label>
        <input type="number" className="w-full border rounded px-3 py-2" required min="0" step="0.01" />
      </div>
      <div>
        <label className="block font-semibold mb-1">Dirt Bike Category</label>
        <select className="w-full border rounded px-3 py-2" required>
          <option value="">Select a category</option>
          {DIRT_BIKE_PARTS_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block font-semibold mb-1">Fits Bike Manufacturer</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={manufacturer}
          onChange={e => {
            setManufacturer(e.target.value);
            setModel('');
            setOtherManufacturer('');
          }}
          required
        >
          <option value="">Select manufacturer</option>
          {MANUFACTURERS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        {manufacturer === 'Other' && (
          <input
            className="mt-2 w-full border rounded px-3 py-2"
            placeholder="Enter manufacturer name"
            value={otherManufacturer}
            onChange={e => setOtherManufacturer(e.target.value)}
            required
          />
        )}
      </div>
      <div>
        <label className="block font-semibold mb-1">Fits Bike Model</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={model}
          onChange={e => setModel(e.target.value)}
          disabled={manufacturer === 'Universal' || !manufacturer || manufacturer === 'Other'}
          required={manufacturer !== 'Universal' && manufacturer !== 'Other'}
        >
          <option value="">{manufacturer === 'Universal' ? 'Not applicable' : 'Select model'}</option>
          {MODELS[manufacturer]?.map((mod) => (
            <option key={mod} value={mod}>{mod}</option>
          ))}
        </select>
      </div>
    </form>
  );
}
