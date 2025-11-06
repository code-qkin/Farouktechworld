import { useState } from "react";
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
} from "lucide-react"
const iphoneModels = [
  // iPhone 6 Series
  "iPhone 6",
  "iPhone 6 Plus",
  "iPhone 6s",
  "iPhone 6s Plus",

  // iPhone SE Series
  "iPhone SE (2016)",
  "iPhone SE (2020)",
  "iPhone SE (2022)",

  // iPhone 7 Series
  "iPhone 7",
  "iPhone 7 Plus",

  // iPhone 8 Series
  "iPhone 8",
  "iPhone 8 Plus",

  // iPhone X Series
  "iPhone X",
  "iPhone XR",
  "iPhone XS",
  "iPhone XS Max",

  // iPhone 11 Series
  "iPhone 11",
  "iPhone 11 Pro",
  "iPhone 11 Pro Max",

  // iPhone 12 Series
  "iPhone 12",
  "iPhone 12 Mini",
  "iPhone 12 Pro",
  "iPhone 12 Pro Max",

  // iPhone 13 Series
  "iPhone 13",
  "iPhone 13 Mini",
  "iPhone 13 Pro",
  "iPhone 13 Pro Max",

  // iPhone 14 Series
  "iPhone 14",
  "iPhone 14 Plus",
  "iPhone 14 Pro",
  "iPhone 14 Pro Max",

  // iPhone 15 Series
  "iPhone 15",
  "iPhone 15 Plus",
  "iPhone 15 Pro",
  "iPhone 15 Pro Max",
  //other models
  "others",
];


const services = [
  { name: "Screen Repair", icon: Monitor },
  { name: "Screen Replacement", icon: PanelBottomClose },
  { name: "Charging Port Repair", icon: Plug },
  { name: "FaceID Repair", icon: ScanFace },
  { name: "Backglass Repair", icon: Phone },
  { name: "White Screen Repair", icon: AlertTriangle },
  { name: "Battery Replacement", icon: BatteryCharging },
  { name: "Casing Change", icon: PanelBottomClose },
  { name: "Battery Boosting", icon: BatteryFull },
  { name: "Line Removal", icon: Slash },
];
const pricingMatrix = {
  "Screen Repair": {
    "iPhone 6": 8000, "iPhone 6 Plus": 9000, "iPhone 6s": 10000, "iPhone 6s Plus": 11000,
    "iPhone SE (2016)": 10000, "iPhone SE (2020)": 12000, "iPhone SE (2022)": 14000,
    "iPhone 7": 12000, "iPhone 7 Plus": 13000, "iPhone 8": 14000, "iPhone 8 Plus": 15000,
    "iPhone X": 18000, "iPhone XR": 20000, "iPhone XS": 22000, "iPhone XS Max": 24000,
    "iPhone 11": 26000, "iPhone 11 Pro": 28000, "iPhone 11 Pro Max": 30000,
    "iPhone 12": 32000, "iPhone 12 Mini": 31000, "iPhone 12 Pro": 34000, "iPhone 12 Pro Max": 36000,
    "iPhone 13": 38000, "iPhone 13 Mini": 37000, "iPhone 13 Pro": 40000, "iPhone 13 Pro Max": 42000,
    "iPhone 14": 45000, "iPhone 14 Plus": 47000, "iPhone 14 Pro": 48000, "iPhone 14 Pro Max": 50000,
    "iPhone 15": 55000, "iPhone 15 Plus": 57000, "iPhone 15 Pro": 60000, "iPhone 15 Pro Max": 65000,
  },
  "Screen Replacement": {
    "iPhone 6": 10000, "iPhone 6 Plus": 11000, "iPhone 6s": 12000, "iPhone 6s Plus": 13000,
    "iPhone SE (2016)": 12000, "iPhone SE (2020)": 14000, "iPhone SE (2022)": 16000,
    "iPhone 7": 14000, "iPhone 7 Plus": 15000, "iPhone 8": 16000, "iPhone 8 Plus": 17000,
    "iPhone X": 20000, "iPhone XR": 22000, "iPhone XS": 24000, "iPhone XS Max": 26000,
    "iPhone 11": 28000, "iPhone 11 Pro": 30000, "iPhone 11 Pro Max": 32000,
    "iPhone 12": 35000, "iPhone 12 Mini": 34000, "iPhone 12 Pro": 37000, "iPhone 12 Pro Max": 39000,
    "iPhone 13": 42000, "iPhone 13 Mini": 41000, "iPhone 13 Pro": 44000, "iPhone 13 Pro Max": 46000,
    "iPhone 14": 50000, "iPhone 14 Plus": 52000, "iPhone 14 Pro": 53000, "iPhone 14 Pro Max": 55000,
    "iPhone 15": 60000, "iPhone 15 Plus": 62000, "iPhone 15 Pro": 63000, "iPhone 15 Pro Max": 65000,
  },
  "Charging Port Repair": {
    "iPhone 6": 5000, "iPhone 6 Plus": 6000, "iPhone 6s": 7000, "iPhone 6s Plus": 8000,
    "iPhone SE (2016)": 7000, "iPhone SE (2020)": 9000, "iPhone SE (2022)": 11000,
    "iPhone 7": 9000, "iPhone 7 Plus": 10000, "iPhone 8": 11000, "iPhone 8 Plus": 12000,
    "iPhone X": 13000, "iPhone XR": 14000, "iPhone XS": 15000, "iPhone XS Max": 16000,
    "iPhone 11": 17000, "iPhone 11 Pro": 18000, "iPhone 11 Pro Max": 19000,
    "iPhone 12": 20000, "iPhone 12 Mini": 19000, "iPhone 12 Pro": 21000, "iPhone 12 Pro Max": 22000,
    "iPhone 13": 23000, "iPhone 13 Mini": 22000, "iPhone 13 Pro": 24000, "iPhone 13 Pro Max": 25000,
    "iPhone 14": 26000, "iPhone 14 Plus": 27000, "iPhone 14 Pro": 27000, "iPhone 14 Pro Max": 28000,
    "iPhone 15": 29000, "iPhone 15 Plus": 30000, "iPhone 15 Pro": 30000, "iPhone 15 Pro Max": 32000,
  },
  "FaceID Repair": {
    "iPhone X": 20000, "iPhone XS": 22000, "iPhone XS Max": 24000,
    "iPhone 11": 26000, "iPhone 11 Pro": 28000, "iPhone 11 Pro Max": 30000,
    "iPhone 12": 32000, "iPhone 12 Mini": 31000, "iPhone 12 Pro": 34000, "iPhone 12 Pro Max": 36000,
    "iPhone 13": 38000, "iPhone 13 Mini": 37000, "iPhone 13 Pro": 40000, "iPhone 13 Pro Max": 42000,
    "iPhone 14": 45000, "iPhone 14 Plus": 47000, "iPhone 14 Pro": 48000, "iPhone 14 Pro Max": 50000,
    "iPhone 15": 53000, "iPhone 15 Plus": 55000, "iPhone 15 Pro": 56000, "iPhone 15 Pro Max": 60000,
  },
  "Backglass Repair": {
    "iPhone 8": 12000, "iPhone 8 Plus": 14000, "iPhone X": 16000, "iPhone XR": 18000,
    "iPhone XS": 20000, "iPhone XS Max": 22000, "iPhone 11": 24000, "iPhone 11 Pro": 26000,
    "iPhone 11 Pro Max": 28000, "iPhone 12": 30000, "iPhone 12 Mini": 29000, "iPhone 12 Pro": 32000, "iPhone 12 Pro Max": 34000,
    "iPhone 13": 36000, "iPhone 13 Mini": 35000, "iPhone 13 Pro": 38000, "iPhone 13 Pro Max": 40000,
    "iPhone 14": 42000, "iPhone 14 Plus": 44000, "iPhone 14 Pro": 44000, "iPhone 14 Pro Max": 46000,
    "iPhone 15": 48000, "iPhone 15 Plus": 50000, "iPhone 15 Pro": 50000, "iPhone 15 Pro Max": 52000,
  },
  "White Screen Repair": {
    "iPhone 6": 6000, "iPhone 7": 8000, "iPhone 8": 10000, "iPhone X": 12000,
    "iPhone XR": 14000, "iPhone XS": 16000, "iPhone 11": 18000, "iPhone 12": 20000,
    "iPhone 13": 22000, "iPhone 14": 25000, "iPhone 15": 28000,
  },
  "Casing Change": {
    "iPhone 6": 5000, "iPhone 6 Plus": 6000, "iPhone 6s": 7000, "iPhone 6s Plus": 8000,
    "iPhone SE (2016)": 7000, "iPhone SE (2020)": 9000, "iPhone SE (2022)": 11000,
    "iPhone 7": 9000, "iPhone 7 Plus": 10000, "iPhone 8": 11000, "iPhone 8 Plus": 12000,
    "iPhone X": 13000, "iPhone XR": 14000, "iPhone XS": 15000, "iPhone XS Max": 16000,
    "iPhone 11": 17000, "iPhone 11 Pro": 18000, "iPhone 11 Pro Max": 19000,
    "iPhone 12": 20000, "iPhone 12 Mini": 19000, "iPhone 12 Pro": 21000, "iPhone 12 Pro Max": 22000,
    "iPhone 13": 23000, "iPhone 13 Mini": 22000, "iPhone 13 Pro": 24000, "iPhone 13 Pro Max": 25000,
    "iPhone 14": 26000, "iPhone 14 Plus": 27000, "iPhone 14 Pro": 27000, "iPhone 14 Pro Max": 28000,
    "iPhone 15": 29000, "iPhone 15 Plus": 30000, "iPhone 15 Pro": 30000, "iPhone 15 Pro Max": 32000,
  },
};

export default function PricingPage() {
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);

  const toggleService = (serviceName) => {
    setSelectedServices((prev) =>
      prev.includes(serviceName)
        ? prev.filter((s) => s !== serviceName)
        : [...prev, serviceName]
    );
  };

  const getTotalPrice = () => {
    if (!selectedModel) return null;
    let total = 0;
    for (const service of selectedServices) {
      const price =
        pricingMatrix[service] && pricingMatrix[service][selectedModel];
      if (price) total += price;
      else return null; // unsupported model
    }
    return total;
  };

  return (
    <section className="bg-purple-50 py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-extrabold text-purple-900 text-center mb-10">
          iPhone Repair Pricing
        </h2>

        <div className="space-y-6 bg-white p-8 rounded-xl shadow-lg">
          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select iPhone Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-3 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">Choose model</option>
              {iphoneModels.map((model, index) => (
                <option key={index} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          {/* Service Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Services
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {services.map(({ name, icon: Icon }, index) => {
                const isSelected = selectedServices.includes(name);
                return (
                  <div
                    key={index}
                    onClick={() => toggleService(name)}
                    className={`flex flex-col items-center p-4 rounded-lg cursor-pointer transition transform hover:scale-105 ${
                      isSelected
                        ? "bg-purple-600 text-white"
                        : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    <Icon className="w-8 h-8 mb-2" />
                    <span className="text-sm font-medium text-center">
                      {name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quote Summary */}
          {selectedModel && selectedServices.length > 0 && (
            <div className="mt-8 animate-fade-in">
              {getTotalPrice() !== null ? (
                <div className="bg-purple-100 p-6 rounded-lg shadow-md">
                  <h4 className="text-lg font-semibold text-purple-900 mb-2">
                    Quote Summary
                  </h4>
                  <p className="text-sm text-gray-700 mb-1">
                    <strong>Model:</strong> {selectedModel}
                  </p>
                  <p className="text-sm text-gray-700 mb-1">
                    <strong>Services:</strong>{" "}
                    {selectedServices.join(", ")}
                  </p>
                  <p className="text-lg font-bold text-purple-800 mt-2">
                    Total: ₦{getTotalPrice().toLocaleString()}
                  </p>
                </div>
              ) : (
                <div className="text-red-600 font-medium">
                  model not supported.
                  <a
                    href="https://wa.me/2348095115931?text=Hello%20FaroukTechWorld"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 inline-flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-full hover:bg-green-600 transition mt-2"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Chat on WhatsApp
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fade-in animation */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </section>
  );
}
