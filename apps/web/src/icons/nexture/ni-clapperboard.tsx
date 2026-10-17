import { NextureIconsProps, sizeHelper, strokeSizeHelper } from "../nexture-icons";

/** A clapperboard: a video being produced. Drawn for FlyeeClub in the Nexture style (24 grid, two tones). */
export default function NiClapperboard({
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
          d="M17.8 11C19.4838 11.1871 20.8129 12.5162 21 14.2C21.1463 15.4833 21.1463 16.7667 21 18.05C20.8129 19.7338 19.4838 21.0629 17.8 21.25C13.9333 21.6908 10.0667 21.6908 6.2 21.25C4.5162 21.0629 3.1871 19.7338 3 18.05C2.8537 16.7667 2.8537 15.4833 3 14.2C3.1871 12.5162 4.5162 11.1871 6.2 11C10.0667 10.5592 13.9333 10.5592 17.8 11Z"
          stroke="currentColor"
          strokeWidth={iconStrokeWidth}
        />
        <path
          d="M17.5772 2.3177C18.5256 2.2238 19.4123 2.7996 19.7122 3.7042C19.7281 3.7519 19.7385 3.8008 19.7433 3.8509C19.8373 4.7992 19.2615 5.6859 18.3569 5.9858C13.9347 7.4658 9.4026 8.4291 4.7607 8.8758C3.8123 8.9697 2.9256 8.3939 2.6258 7.4893C2.6098 7.4416 2.5994 7.3927 2.5946 7.3426C2.5006 6.3943 3.0764 5.5076 3.981 5.2077C8.4033 3.7277 12.9353 2.7644 17.5772 2.3177Z"
          stroke="currentColor"
          strokeWidth={iconStrokeWidth}
        />
        <path
          opacity={oneTone ? 1 : 0.6}
          d="M7.4017 8.3144L8.5783 4.2305"
          stroke="currentColor"
          strokeWidth={iconStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          opacity={oneTone ? 1 : 0.6}
          d="M11.5588 7.4308L12.7354 3.3469"
          stroke="currentColor"
          strokeWidth={iconStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          opacity={oneTone ? 1 : 0.6}
          d="M15.7159 6.5471L16.8925 2.4633"
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
          d="M17.8 10.25C19.8785 10.481 21.519 12.1215 21.75 14.2C21.8963 15.4833 21.8963 16.7667 21.75 18.05C21.519 20.1285 19.8785 21.769 17.8 22C13.9333 22.4408 10.0667 22.4408 6.2 22C4.1215 21.769 2.481 20.1285 2.25 18.05C2.1037 16.7667 2.1037 15.4833 2.25 14.2C2.481 12.1215 4.1215 10.481 6.2 10.25C10.0667 9.8092 13.9333 9.8092 17.8 10.25Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M17.4213 1.5841C18.7648 1.451 20.0209 2.2667 20.4458 3.5482C20.4617 3.5959 20.4721 3.6449 20.477 3.6949C20.6101 5.0384 19.7943 6.2946 18.5129 6.7194C14.0906 8.1994 9.5585 9.1627 4.9166 9.6094C3.5731 9.7425 2.317 8.9268 1.8921 7.6453C1.8762 7.5975 1.8658 7.5486 1.861 7.4985C1.7278 6.1551 2.5436 4.8989 3.8251 4.4741C8.2473 2.9941 12.7794 2.0308 17.4213 1.5841ZM8.1223 8.522L9.299 4.4382A0.75 0.75 0 0 0 7.8576 4.0229L6.681 8.1068A0.75 0.75 0 0 0 8.1223 8.522ZM12.2795 7.6384L13.4561 3.5545A0.75 0.75 0 0 0 12.0147 3.1393L10.8381 7.2231A0.75 0.75 0 0 0 12.2795 7.6384ZM16.4366 6.7548L17.6132 2.6709A0.75 0.75 0 0 0 16.1719 2.2556L14.9952 6.3395A0.75 0.75 0 0 0 16.4366 6.7548Z"
          fill="currentColor"
        />
        <path
          opacity={oneTone ? 0 : 0.4}
          d="M8.1223 8.522L9.299 4.4382A0.75 0.75 0 0 0 7.8576 4.0229L6.681 8.1068A0.75 0.75 0 0 0 8.1223 8.522Z"
          fill="currentColor"
        />
        <path
          opacity={oneTone ? 0 : 0.4}
          d="M12.2795 7.6384L13.4561 3.5545A0.75 0.75 0 0 0 12.0147 3.1393L10.8381 7.2231A0.75 0.75 0 0 0 12.2795 7.6384Z"
          fill="currentColor"
        />
        <path
          opacity={oneTone ? 0 : 0.4}
          d="M16.4366 6.7548L17.6132 2.6709A0.75 0.75 0 0 0 16.1719 2.2556L14.9952 6.3395A0.75 0.75 0 0 0 16.4366 6.7548Z"
          fill="currentColor"
        />
      </svg>
    );
  }
}
