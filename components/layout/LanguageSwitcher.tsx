export default function LanguageSwitcher() {
  return (
    <select
      defaultValue="ko"
      aria-label="언어 선택"
      className="border border-[#2a3952] bg-[#172235] text-[#f7f9fc] rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#10b998]"
    >
      <option value="ko" className="bg-[#172235] text-[#f7f9fc]">한국어</option>
      <option value="en" className="bg-[#172235] text-[#f7f9fc]">English</option>
    </select>
  );
}
