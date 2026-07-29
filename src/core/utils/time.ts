const MAX_DISPLAY_SECONDS = 99 * 60 + 59; // 5999

export const formatSecondsToTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) {
    return '00:00';
  }

  if (seconds > MAX_DISPLAY_SECONDS) {
    return '99:59';
  }

  const minutes = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(s).padStart(2, '0');
  return `${formattedMinutes}:${formattedSeconds}`;
}