"use client";

import { useState, useEffect, useRef } from "react";

const CustomRangeSlider = ({
  min = 0,
  max = 5,
  defaultValue = 5,
  onChange,
}: any) => {
  const [value, setValue] = useState(defaultValue);
  const rangeRef = useRef(null);
  const rangeFillRef = useRef(null);

  useEffect(() => {
    updateRangeFill();
  }, [value]);

  const updateRangeFill = () => {
    if (rangeFillRef.current) {
      const percentage = ((value - min) / (max - min)) * 100;
      (rangeFillRef.current as any).style.width = `${percentage}%`;
    }
  };

  const handleChange = (e: any) => {
    const newValue = parseInt(e.target.value, 10);
    setValue(newValue);
    if (onChange) {
      onChange(newValue);
    }
  };

  return (
    <div className="relative w-full my-1">
      <div className="absolute w-full h-2 bg-white border border-gray-300 rounded-md top-1/2 -translate-y-1/2 z-0"></div>
      <div
        ref={rangeFillRef}
        className="absolute h-2 bg-[#bf8ac1] rounded-md top-1/2 -translate-y-1/2 z-1 left-0"
        style={{ width: `${((value - min) / (max - min)) * 100}%` }}
      ></div>
      <input
        ref={rangeRef}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={handleChange}
        className="relative w-full h-2 bg-transparent appearance-none cursor-pointer z-10 focus:outline-none"
        style={{
          WebkitAppearance: "none",
          appearance: "none",
        }}
      />
      <style jsx>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 6px;
          height: 16px;
          background: #bf8ac1;
          cursor: pointer;
          position: relative;
          z-index: 10;
          border-radius: 2px;
        }

        input[type="range"]::-moz-range-thumb {
          width: 6px;
          height: 16px;
          background: #bf8ac1;
          cursor: pointer;
          position: relative;
          z-index: 10;
          border: none;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
};

export default CustomRangeSlider;
