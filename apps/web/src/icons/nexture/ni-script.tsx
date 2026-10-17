import { NextureIconsProps, sizeHelper, strokeSizeHelper } from "../nexture-icons";

/** A script: the text of a video, line by line. Drawn for FlyeeClub in the Nexture style (24 grid, two tones). */
export default function NiScript({
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
          d="M3.36984 8.67144C3.73938 5.34558 6.39015 2.70123 9.71063 2.28617V2.28617C11.2181 2.09774 12.7819 2.09774 14.2894 2.28617V2.28617C17.6099 2.70123 20.2606 5.34558 20.6302 8.67144V8.67144C20.876 10.8837 20.876 13.1163 20.6302 15.3286V15.3286C20.2606 18.6544 17.6099 21.2988 14.2894 21.7138V21.7138C12.7819 21.9023 11.2181 21.9023 9.71063 21.7138V21.7138C6.39015 21.2988 3.73938 18.6544 3.36984 15.3286V15.3286C3.12404 13.1163 3.12404 10.8837 3.36984 8.67144V8.67144Z"
          stroke="currentColor"
          strokeWidth={iconStrokeWidth}
        />
        <path
          d="M10.9394 10.1541C11.4603 9.6639 11.4603 8.8361 10.9394 8.3459L10.7147 8.1344C10.0697 7.5274 9.2436 7.1485 8.3628 7.0558L8.3317 7.0525C7.7351 6.9897 7.1864 7.3845 7.0562 7.9701L7.0562 7.9701C6.8689 8.8131 6.8689 9.6869 7.0562 10.5299L7.0562 10.5299C7.1864 11.1155 7.7351 11.5103 8.3317 11.4475L8.3628 11.4442C9.2436 11.3515 10.0697 10.9726 10.7147 10.3656L10.9394 10.1541Z"
          fill="currentColor"
        />
        <path
          opacity={oneTone ? 1 : 0.6}
          d="M12.25 9.25L16 9.25"
          stroke="currentColor"
          strokeWidth={iconStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          opacity={oneTone ? 1 : 0.6}
          d="M8 13.25L16 13.25"
          stroke="currentColor"
          strokeWidth={iconStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          opacity={oneTone ? 1 : 0.6}
          d="M8 17.25L13 17.25"
          stroke="currentColor"
          strokeWidth={iconStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
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
          fillRule="evenodd"
          clipRule="evenodd"
          d="M9.61665 1.54161C11.1857 1.34549 12.8132 1.34552 14.3823 1.54161C18.0405 1.99911 20.9666 4.91143 21.3754 8.58751C21.6273 10.8546 21.6273 13.1436 21.3754 15.4108C20.9669 19.0872 18.0408 22.0001 14.3823 22.4576C12.8132 22.6537 11.1857 22.6538 9.61665 22.4576C5.95832 21.9999 3.03197 19.0871 2.62348 15.4108C2.37162 13.1436 2.37158 10.8546 2.62348 8.58751C3.0323 4.91153 5.95859 1.99928 9.61665 1.54161ZM11.1248 10.2362C11.693 9.7015 11.693 8.7985 11.1248 8.2638L10.8796 8.033C10.1761 7.3708 9.2748 6.9575 8.3139 6.8563L8.28 6.8528C7.6292 6.7842 7.0306 7.2149 6.8886 7.8537L6.8886 7.8537C6.6842 8.7734 6.6842 9.7266 6.8886 10.6463L6.8886 10.6463C7.0306 11.2851 7.6292 11.7158 8.28 11.6473L8.3139 11.6437C9.2748 11.5425 10.1761 11.1292 10.8796 10.467L11.1248 10.2362ZM12.25 10L16 10A0.75 0.75 0 0 0 16 8.5L12.25 8.5A0.75 0.75 0 0 0 12.25 10ZM8 14L16 14A0.75 0.75 0 0 0 16 12.5L8 12.5A0.75 0.75 0 0 0 8 14ZM8 18L13 18A0.75 0.75 0 0 0 13 16.5L8 16.5A0.75 0.75 0 0 0 8 18Z"
          fill="currentColor"
        />
        <path
          opacity={oneTone ? 0 : 0.4}
          d="M12.25 10L16 10A0.75 0.75 0 0 0 16 8.5L12.25 8.5A0.75 0.75 0 0 0 12.25 10Z"
          fill="currentColor"
        />
        <path
          opacity={oneTone ? 0 : 0.4}
          d="M8 14L16 14A0.75 0.75 0 0 0 16 12.5L8 12.5A0.75 0.75 0 0 0 8 14Z"
          fill="currentColor"
        />
        <path
          opacity={oneTone ? 0 : 0.4}
          d="M8 18L13 18A0.75 0.75 0 0 0 13 16.5L8 16.5A0.75 0.75 0 0 0 8 18Z"
          fill="currentColor"
        />
      </svg>
    );
  }
}
