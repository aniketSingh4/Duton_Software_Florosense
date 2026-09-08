const VIDEO_SRC = "/856171-hd_1920_1080_30fps.mp4"

export function VideoBackground({
  overlayClassName = "bg-background/70 backdrop-blur",
  preload,
}) {
  return (
    <>
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        {...(preload != null ? { preload } : {})}
      >
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>
      <div className={`absolute inset-0 ${overlayClassName}`} />
    </>
  )
}
