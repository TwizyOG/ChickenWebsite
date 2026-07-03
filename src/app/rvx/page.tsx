import RvxHub from "@/components/RvxHub";
import { RVX_EVENT } from "@/lib/rvx";

export const metadata = {
  title: "RV X — ChickenAndy",
  description: RVX_EVENT.premise,
};

export default function RvxPage() {
  return <RvxHub />;
}
