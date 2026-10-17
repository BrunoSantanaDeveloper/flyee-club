import { NextureIconsProps, sizeHelper, strokeSizeHelper } from "../nexture-icons";

/** A lens over a play mark: research on videos. Drawn for FlyeeClub in the Nexture style (24 grid, two tones). */
export default function NiVideoSearch({
  className,
  variant = "outlined",
  size = "medium",
  oneTone = false,
}: NextureIconsProps) {
  const iconSize = sizeHelper(size);
  const iconStrokeWidth = strokeSizeHelper(iconSize);

  if (variant === "outlined") {
    return (
      <svg
        width={iconSize}
        height={iconSize}
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          opacity={oneTone ? 1 : 0.6}
          d="M22 22L18.5 18.5"
          stroke="currentColor"
          strokeWidth={iconStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="11.5" cy="11.5" r="9.5" stroke="currentColor" strokeWidth={iconStrokeWidth} />
        <path
          d="M15.0665 12.815C15.824 12.102 15.824 10.898 15.0665 10.185L14.7395 9.8773C13.8014 8.9944 12.5998 8.4433 11.3186 8.3084L11.2733 8.3037C10.4056 8.2123 9.6074 8.7865 9.4181 9.6383L9.4181 9.6383C9.1457 10.8645 9.1457 12.1355 9.4181 13.3617L9.4181 13.3617C9.6074 14.2135 10.4056 14.7877 11.2733 14.6963L11.3186 14.6916C12.5998 14.5567 13.8014 14.0056 14.7395 13.1227L15.0665 12.815Z"
          fill="currentColor"
        />
      </svg>
    );
  } else {
    return (
      <svg
        width={iconSize}
        height={iconSize}
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          opacity={oneTone ? 1 : 0.4}
          d="M19.0303 17.9697C18.7374 17.6768 18.2627 17.6768 17.9698 17.9697C17.6769 18.2626 17.6769 18.7373 17.9698 19.0302L21.4698 22.5302C21.7627 22.8231 22.2374 22.8231 22.5303 22.5302C22.8232 22.2373 22.8232 21.7626 22.5303 21.4697L19.0303 17.9697Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M11.5 1.25C17.1609 1.25 21.75 5.83908 21.75 11.5C21.75 17.1609 17.1609 21.75 11.5 21.75C5.83908 21.75 1.25 17.1609 1.25 11.5C1.25 5.83908 5.83908 1.25 11.5 1.25ZM15.3446 12.9383C16.1731 12.1584 16.1731 10.8416 15.3446 10.0617L14.987 9.7252C13.9609 8.7595 12.6466 8.1567 11.2453 8.0092L11.1958 8.004C10.2468 7.9041 9.3737 8.5322 9.1667 9.4638L9.1667 9.4638C8.8687 10.8049 8.8687 12.1951 9.1667 13.5362L9.1667 13.5362C9.3737 14.4679 10.2468 15.0959 11.1958 14.996L11.2453 14.9908C12.6466 14.8433 13.9609 14.2405 14.987 13.2748L15.3446 12.9383Z"
          fill="currentColor"
        />
        <path
          opacity={oneTone ? 0 : 0.4}
          d="M15.3446 12.9383C16.1731 12.1584 16.1731 10.8416 15.3446 10.0617L14.987 9.7252C13.9609 8.7595 12.6466 8.1567 11.2453 8.0092L11.1958 8.004C10.2468 7.9041 9.3737 8.5322 9.1667 9.4638L9.1667 9.4638C8.8687 10.8049 8.8687 12.1951 9.1667 13.5362L9.1667 13.5362C9.3737 14.4679 10.2468 15.0959 11.1958 14.996L11.2453 14.9908C12.6466 14.8433 13.9609 14.2405 14.987 13.2748L15.3446 12.9383Z"
          fill="currentColor"
        />
      </svg>
    );
  }
}
