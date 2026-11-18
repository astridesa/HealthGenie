// components/StyledSelectorWithImageAndIcon.js
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import { useState } from "react";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import Image from "next/image";

export default function StyledSelectorWithImageAndIcon({
  options,
}: {
  options: any;
}) {
  const [selected, setSelected] = useState(options[0]);

  return (
    <div className="min-w-48 mb-2 mr-4">
      <Listbox value={selected} onChange={setSelected}>
        <div className="relative">
          {/* 下拉按钮 */}
          <ListboxButton className="w-full px-4 py-2 text-left text-md font-base border border-gray-300 rounded-lg bg-white shadow-lg focus:outline-none hover:bg-[#e5e5e5] flex items-center justify-between">
            {/* 前面是图片 */}
            <div className="flex flex-row items-center">
              <Image width={12} height={12} src={selected.image} alt="icon" />
              <span className="ml-2">{selected.label}</span>
            </div>

            {/* 后面是图标 */}
            <KeyboardArrowDownIcon />
          </ListboxButton>

          {/* 下拉选项 */}
          <ListboxOptions className="absolute mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-300 rounded-lg shadow-lg z-10">
            {options.map((option: any) => (
              <ListboxOption key={option.value} value={option}>
                {({ active, selected }) => (
                  <li
                    className={`px-4 py-2 cursor-pointer text-base flex items-center hover:bg-[#e5e5e5]`}
                  >
                    {/* 每个选项的图片 */}
                    <Image
                      width={12}
                      height={12}
                      src={option.image}
                      alt="icon"
                    />
                    <span className="ml-1">{option.label}</span>
                  </li>
                )}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </div>
      </Listbox>
    </div>
  );
}

// 选项列表（这里每个选项有一个图片和文本）
const options = [
  { value: "option1", label: "选项 1", image: "/path/to/image1.jpg" },
  { value: "option2", label: "选项 2", image: "/path/to/image2.jpg" },
  { value: "option3", label: "选项 3", image: "/path/to/image3.jpg" },
  { value: "option4", label: "选项 4", image: "/path/to/image4.jpg" },
];
