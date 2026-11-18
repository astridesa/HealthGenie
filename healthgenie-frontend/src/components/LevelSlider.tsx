import React from 'react';
import CustomizeSlider from './CustomizeSlider';

interface LevelSliderProps {
  value: number;
  onChange: (value: number) => void;
}

const LevelSlider: React.FC<LevelSliderProps> = ({ value, onChange }) => {
  return (
    <div className="absolute bg-white shadow-lg rounded-lg p-2 flex flex-col items-center z-50"
         style={{
           right: '20px',
           top: '20px',
           minWidth: '180px'
         }}>
      <div className="flex justify-between w-full mb-1">
        <span className="text-xs text-gray-600">Show less</span>
        <span className="text-xs text-gray-600">Show more</span>
      </div>
      
      <CustomizeSlider
        min={0}
        max={2}
        defaultValue={value}
        onChange={onChange}
      />
      
      {/* Level labels */}
      <div className="flex justify-between w-full mt-1">
        <span className="text-xs text-gray-500">x1</span>
        <span className="text-xs text-gray-500">x2</span>
        <span className="text-xs text-gray-500">x3</span>
      </div>
    </div>
  );
};

export default LevelSlider; 