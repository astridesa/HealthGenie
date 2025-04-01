"use client";
import { useState } from "react";
import Image from "next/image";
import CancelIcon from "@mui/icons-material/Cancel";
import CustomizeSlider from "./CustomizeSlider";

export default function PreferenceSelector(props: any) {
  return (
    <div className="absolute p-4 bg-white shadow-lg rounded-xl w-80 right-6 bottom-8 border border-[#f6f0f6] items-center">
      <p className="text-gray-700 font-medium mb-2">
        {props.name
          ? `Your preference towards ${props.name}`
          : "Your preference"}
      </p>

      <div className="flex flex-row items-center">
        <Image
          width={20}
          height={20}
          alt="dislike"
          src="/dislike.jpg"
          className="mx-2"
        />
        {/* 滑块 */}
        <div className="w-full flex flex-col items-center">
          {/* 滑块 */}
          <CustomizeSlider onChange={props.onChange} />
        </div>
        <Image
          width={20}
          height={20}
          alt="like"
          src="/like.jpg"
          className="mx-2"
        />
      </div>
      <div className="flex flex-row justify-center">
        <button
          className="text-red-500 border border-[#f3c4f4] rounded-lg py-1 px-2 bg-[#f9f5f9] flex flex-row items-center"
          onClick={props.cancel}
        >
          <CancelIcon />
          <span className="mx-1">Clear</span>
        </button>
      </div>
    </div>
  );
}
