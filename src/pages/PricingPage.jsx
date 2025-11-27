import { useState, useMemo } from "react";
import React from "react";
import {
  Monitor,
  PanelBottomClose,
  Plug,
  ScanFace,
  Phone,
  AlertTriangle,
  BatteryCharging,
  BatteryFull,
  Slash,
  MessageCircle,
  Layers,
  Hexagon,
  Battery,
  Cpu,
  Box
} from "lucide-react";

/* phoneModels (unchanged) */
const phoneModels = [
  "iPhone 6", "iPhone 6 Plus", "iPhone 6s", "iPhone 6s Plus",
  "iPhone SE (2022)",
  "iPhone 7", "iPhone 7 Plus",
  "iPhone 8", "iPhone 8 Plus",
  "iPhone X", "iPhone XR", "iPhone XS", "iPhone XS Max",
  "iPhone 11", "iPhone 11 Pro", "iPhone 11 Pro Max",
  "iPhone 12", "iPhone 12 Mini", "iPhone 12 Pro", "iPhone 12 Pro Max",
  "iPhone 13", "iPhone 13 Mini", "iPhone 13 Pro", "iPhone 13 Pro Max",
  "iPhone 14", "iPhone 14 Plus", "iPhone 14 Pro", "iPhone 14 Pro Max",
  "iPhone 15", "iPhone 15 Plus", "iPhone 15 Pro", "iPhone 15 Pro Max",
  "iPhone 16", "iPhone 16 Plus", "iPhone 16 Pro", "iPhone 16 Pro Max",
  "iPhone 17", "iPhone 17 Pro Max",
  "others"
];

/* pricingData (exact object you provided) */
const pricingData = {
  'Glass + OCA': [
    { model: '6G - 6S Plus', price: 2200 },
    { model: '7G - 8 Plus', price: 2300 },
    { model: 'X, XS, XS Max', price: 2200 },
    { model: '11 - 11 Pro Max', price: 2500 },
    { model: '12 - 12 Pro Max', price: 2700 },
    { model: '13 - 13 Pro Max', price: 2800 },
    { model: '14 - 14 Pro Max', price: 3000 },
    { model: '15 - 15 Pro Max', price: 3100 },
    { model: '16 - 16 Pro Max', price: 3500 },
    { model: '17 - 17 Pro Max', price: 6000 }
  ],
  'Frame Replacement': [
    { model: 'X - XS, XS Max', price: 2500 },
    { model: '11 Pro - 11 Pro Max', price: 2700 },
    { model: '12 - 12 Pro Max', price: 3000 },
    { model: '13 - 13 Pro Max', price: 3000 },
    { model: '14 - 14 Pro Max', price: 3500 },
    { model: '15 - 15 Pro Max', price: 3700 },
    { model: '16 - 16 Pro Max', price: 4000 },
    { model: '17 - 17 Pro Max', price: 6000 }
  ],
  'AY Battery Tag': [
    { model: '15 Pro / 15 Pro Max', price: 11800 },
    { model: '15 / 15 Plus', price: 11500 },
    { model: '14 / 14 Pro Max', price: 11500 },
    { model: '14 - 14 Plus', price: 11000 },
    { model: '13 Pro / 13 Pro Max', price: 11000 },
    { model: '13', price: 10500 },
    { model: '12 - 12 Pro Max', price: 8500 },
    { model: '11 - 11 Pro Max', price: 8000 }
  ],
  'Face Tag JCID': [
    { model: '15 Pro / 15 Pro Max', price: 25000 },
    { model: '15 - 15 Plus', price: 24000 },
    { model: '14 Pro / 14 Pro Max', price: 24000 },
    { model: '14 - 14 Plus', price: 23000 },
    { model: '13 Pro / 13 Pro Max', price: 24000 },
    { model: '13', price: 20000 },
    { model: '12 - 12 Pro Max', price: 14500 },
    { model: '11', price: 12500 },
    { model: '11 Pro Max', price: 12500 },
    { model: 'XS / XR / XS Max', price: 11500 }
  ],
  'JCID Receiver': [
    { model: 'X', price: 18000 },
    { model: 'XS', price: 18000 },
    { model: 'XS Max', price: 20000 },
    { model: '11', price: 22000 },
    { model: '11 Pro Max', price: 22000 },
    { model: '11 Pro', price: 22000 },
    { model: '12 / 12 Pro Max', price: 28000 },
    { model: '13', price: 30000 },
    { model: '13 Pro / 13 Pro Max', price: 33000 },
    { model: '14 Pro / 14 Pro Max', price: 35000 }
  ],
  'Permanent Battery': [
    { model: '15 Pro / 15 Pro Max', price: 25000 },
    { model: '14 Pro / 14 Pro Max', price: 18000 },
    { model: '13', price: 15000 },
    { model: '13 / 13 Pro Max', price: 15000 },
    { model: '11', price: 10000 },
    { model: '11 Pro / 11 Pro Max', price: 10000 },
  ],
  'OLED Screen': [
    { model: '16', price: 230000 },
    { model: '16 Pro', price: '450K OLED / 550K FOLLOW COME' },
    { model: '16 Pro Max', price: '350K OLED / 570K FOLLOW COME' },
    { model: '15', price: 200000 },
    { model: '15 Pro', price: 250000 },
    { model: '15 Pro Max', price: 230000 },
    { model: '15 Plus', price: 200000 },
    { model: '14 Plus', price: 180000 },
    { model: '14 Pro', price: 200000 },
    { model: '14 Pro Max', price: 200000 },
    { model: '13', price: 77000 },
    { model: '13 Pro', price: 110000 },
    { model: '13 Pro Max', price: 110000 },
    { model: '12', price: 73000 },
    { model: '12 Pro Max', price: 85000 },
    { model: '11 Pro Max', price: 53000 },
    { model: 'XS Max', price: 45000 }
  ],
  'Incell Screen': [
    { model: '15 Pro', price: 'Available' },
    { model: '15 Pro Max', price: 'Available' },
    { model: '14 Pro', price: 'Available' },
    { model: '14 Pro Max', price: 'Available' },
    { model: '13', price: 38000 },
    { model: '13 Pro', price: 45000 },
    { model: '13 Pro Max', price: 55000 },
    { model: '12 Pro Max', price: 45000 },
    { model: '12', price: 40000 },
    { model: '11 Pro Max', price: 25000 },
    { model: '11 Pro', price: 25000 },
    { model: 'XR', price: 22000 },
    { model: '11', price: 22000 },
    { model: 'X', price: 16000 },
    { model: 'XS', price: 18000 }
  ],
  'Empty Casing': [
    { model: '16', price: 50000 },
    { model: '16 Plus', price: 55000 },
    { model: '16 Pro', price: 55000 },
    { model: '16 Pro Max', price: 57000 },
    { model: '15', price: 40000 },
    { model: '15 Pro', price: 55000 },
    { model: '15 Pro Max', price: 55000 },
    { model: '15 Plus', price: 55000 },
    { model: '14', price: 40000 },
    { model: '14 Pro', price: 43000 },
    { model: '14 Pro Max', price: 43000 },
    { model: '13 Pro Max', price: 40000 },
    { model: '13 Pro', price: 40000 },
    { model: '13', price: 35000 },
    { model: '12 Pro Max', price: 35000 },
    { model: '12 Pro', price: 30000 },
    { model: '12', price: 25000 },
    { model: 'XS Max', price: 25000 },
    { model: '11 Pro Max', price: 30000 },
    { model: '11 Pro', price: 30000 },
    { model: '11', price: 15000 },
    { model: 'XR', price: 15000 }
  ],
  'Casing & Fixing': [
    { model: '16', price: 60000 },
    { model: '16 Plus', price: 65000 },
    { model: '16 Pro', price: 90000 },
    { model: '16 Pro Max', price: 100000 },
    { model: '15', price: 50000 },
    { model: '15 Plus', price: 60000 },
    { model: '15 Pro', price: 75000 },
    { model: '15 Pro Max', price: 75000 },
    { model: '14', price: 45000 },
    { model: '14 Pro', price: 55000 },
    { model: '14 Pro Max', price: 55000 },
    { model: '14 Plus', price: 55000 },
    { model: '13', price: 40000 },
    { model: '13 Pro', price: 45000 },
    { model: '13 Pro Max', price: 45000 },
    { model: '12', price: 30000 },
    { model: '12 Pro', price: 40000 },
    { model: '12 Pro Max', price: 45000 }
  ],
  'Screen Baking': [
    { model: '16 Pro Max', price: '250K' },
    { model: '16 Pro', price: '250K' },
    { model: '16 Plus', price: '150K' },
    { model: '16', price: '150K' },
    { model: '15', price: 70000 },
    { model: '15 Plus', price: 80000 },
    { model: '15 Pro Max', price: 130000 },
    { model: '15 Pro', price: 130000 },
    { model: '14', price: 60000 },
    { model: '14 Plus', price: 60000 },
    { model: '14 Pro', price: 100000 },
    { model: '14 Pro Max', price: 100000 },
    { model: '13 Pro Max', price: '60K' },
    { model: '13 Pro', price: '60K' },
    { model: '13', price: 40000 },
    { model: '12 Pro Max', price: 40000 },
    { model: '12 Pro', price: 30000 },
    { model: '11 Pro Max', price: 25000 },
    { model: 'XS Max', price: 20000 },
    { model: 'XR', price: 15000 },
    { model: '11', price: 180000 }
  ]
};

/* build services list dynamically from pricingData keys with icons mapping */
const iconMap = {
  'Glass + OCA': Layers,
  'Frame Replacement': Hexagon,
  'AY Battery Tag': BatteryCharging,
  'Face Tag JCID': ScanFace,
  'JCID Receiver': Cpu,
  'Permanent Battery': BatteryFull,
  'OLED Screen': Monitor,
  'Incell Screen': PanelBottomClose,
  'Empty Casing': Phone,
  'Casing & Fixing': Plug,
  'Screen Baking': Box
};

const services = Object.keys(pricingData).map((name) => ({
  name,
  icon: iconMap[name] || Monitor
}));

/* helper utilities */
const normalize = (str = "") =>
  str.toLowerCase().replace(/iphone\s*/i, "").replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();

const formatPrice = (price) =>
  typeof price === "number" ? `₦${price.toLocaleString()}` : price;

/* Pricing Page component */
export default function PricingPage() {
  const [selectedModel, setSelectedModel] = useState("");



  const findPriceFor = (serviceName, model) => {
    if (!model || !serviceName) return null;

    const list = pricingData[serviceName];
    if (!list) return null;

    // Extract model info
    const cleanModel = model.toLowerCase().replace(/iphone\s*/gi, '').trim();
    const selectedNumber = cleanModel.match(/\d+/)?.[0];
    const selectedVariant = cleanModel.replace(selectedNumber, '').trim(); // "pro", "pro max", etc.

    console.log('🔍 Model:', cleanModel, 'Number:', selectedNumber, 'Variant:', selectedVariant);

    const match = list.find((item) => {
      const cleanItem = item.model.toLowerCase().trim();

      // Handle range formats: "13-13pro max", "13pro/13pro max"
      if (cleanItem.includes('-') || cleanItem.includes('/')) {
        const parts = cleanItem.split(/[-\/]/).map(part => part.trim());
        const baseNumber = parts[0].match(/\d+/)?.[0];

        // Check if base number matches AND variant is compatible
        if (baseNumber === selectedNumber) {
          console.log('✅ Range match:', cleanItem, 'for', cleanModel);
          return true;
        }
      }

      // Direct match
      const itemNumber = cleanItem.match(/\d+/)?.[0];
      return itemNumber === selectedNumber;
    });

    return match ? match.price : null;
  };




  const servicesList = useMemo(() => services, []);

  return (
    <section className="bg-purple-50 pt-20 sm:pt-16 px-4">
      <div className="gap-10 px-1">
        {/* Main Form */}
        <div className="space-y-8 bg-white p-8 rounded-xl shadow-lg mb-5">
          <h2 className="text-4xl font-extrabold text-purple-900 text-center mb-6">
            Phone Repair Pricing
          </h2>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Phone Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-3 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">Choose model</option>
              {phoneModels.map((model, index) => (
                <option key={index} value={model}>{model}</option>
              ))}
            </select>
          </div>

          {/* Service Selection */}
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {servicesList.map(({ name, icon: Icon }, index) => {
                const pricePreview = findPriceFor(name, selectedModel);
                return (
                  <div
                    key={index}
                    className="flex bg-purple-100 text-purple-900 flex-col items-center justify-center p-5 rounded-xl cursor-pointer transition transform hover:scale-105 shadow-sm bg-pu "
                  >
                    <Icon className="w-10 h-10 mb-3" />
                    <span className="text-sm font-semibold text-center">{name}</span>
                    <span className="text-xs mt-2">
                      {selectedModel
                        ? pricePreview
                          ? formatPrice(pricePreview)
                          : "No price"
                        : "Choose model"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full service tables (accordion-like) */}
          <div className="mt-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3">All Services & Prices</h3>
            <div className="space-y-6">
              {Object.entries(pricingData).map(([service, items]) => (
                <div key={service} className="bg-white border rounded-lg shadow-sm">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {React.createElement(iconMap[service] || Monitor, { className: "w-6 h-6 text-purple-700" })}
                      <h4 className="font-semibold">{service}</h4>
                    </div>
                    <div className="text-sm text-gray-500">{items.length} entries</div>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="overflow-x-auto">
                      <table className="w-full table-auto text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 uppercase">
                            <th className="px-3 py-2">Model / Range</th>
                            <th className="px-3 py-2">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it) => (
                            <tr key={it.model} className="border-t">
                              <td className="px-3 py-2">{it.model}</td>
                              <td className="px-3 py-2">{formatPrice(it.price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
