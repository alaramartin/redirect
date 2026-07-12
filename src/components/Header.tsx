import { formatTotalTime } from "../shared/format";

interface HeaderProps {
  totalSeconds: number;
}

export default function Header({ totalSeconds }: HeaderProps) {
  return (
    <header>
      <span>Screen time</span>
      <span className="header-total">{formatTotalTime(totalSeconds)}</span>
    </header>
  );
}
