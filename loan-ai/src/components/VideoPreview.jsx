import { useRef, useState } from "react";
import { Play } from "lucide-react";

const VideoPreview = () => {
  const videoRef = useRef(null);
  const [isStarted, setIsStarted] = useState(false);

  const handlePlay = () => {
    setIsStarted(true);

    setTimeout(() => {
      videoRef.current?.play();
    }, 100);
  };

  return (
    <div className="scroll-mt-24 bg-linear-to-b from-[#0b0f2a] to-[#10163a] py-16 px-5">
      <div className="max-w-4xl mx-auto relative aspect-video rounded-xl overflow-hidden shadow-lg">
        {/* VIDEO */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          controls={isStarted}
        >
          <source
            src="https://video.wixstatic.com/video/4cbb8e_126995943e544b42955e369236dd4f2a/1080p/mp4/file.mp4"
            type="video/mp4"
          />
        </video>

        {/* THUMBNAIL OVERLAY */}
        {!isStarted && (
          <div
            className="absolute inset-0 cursor-pointer group"
            onClick={handlePlay}
          >
            {/* Thumbnail */}
            <img
              src="https://cdn.dribbble.com/userupload/25325621/file/original-5a677b14223070a85538ed541d78e3b0.png"
              alt="video thumbnail"
              className="w-full h-full object-cover"
            />

            {/* Dark Overlay */}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition"></div>

            {/* Play Button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center justify-center w-20 h-20 rounded-full border-2 border-white bg-transparent shadow-xl group-hover:scale-110 transition">
                {/* Outer Ring */}
                <div className="absolute w-18 h-18 rounded-full border-4 border-white/40 animate-ping"></div>

                {/* Triangle */}
                <div className="ml-1 text-2xl text-white">
                  <Play />
                </div>
              </div>
            </div> 
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPreview;
