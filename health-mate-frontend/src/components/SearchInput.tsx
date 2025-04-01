import { useState } from "react";
import SearchIcon from "@mui/icons-material/Search";

export default function SearchInput() {
  const [searchTerm, setSearchTerm] = useState("");

  const handleChange = (e: any) => {
    setSearchTerm(e.target.value);
  };

  const handleSearch = () => {
    // 执行搜索逻辑
    console.log("Searching for:", searchTerm);
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* 输入框 */}
      <input
        type="text"
        value={searchTerm}
        onChange={handleChange}
        onKeyDown={(e) => e.key === "Enter" && handleSearch()} // 支持回车键搜索
        className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-xl focus:outline-none"
        placeholder="请输入搜索内容"
      />

      {/* 搜索图标 */}
      <SearchIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
    </div>
  );
}
