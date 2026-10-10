import { toastMsg } from '../store/state.js';
export default function Toast() {
  const m = toastMsg.value;
  if (!m) return null;
  return <div class="toast" role="status">{m}</div>;
}
