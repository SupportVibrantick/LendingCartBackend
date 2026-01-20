import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";

interface Testimonial {
  id: number;
  name: string;
  role: string;
  date: string;
  rating: number;
  content: string;
  image: string;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "Ray Robertson",
    role: "CEO Company",
    date: "10th Feb, 2023",
    rating: 5,
    content: "Lorem ipsum dolor sit amet consectetur adipisicing elit.",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ray",
  },
  {
    id: 2,
    name: "Sherl",
    role: "CEO Company",
    date: "10th Feb, 2023",
    rating: 5,
    content: "Duis aute irure dolor in reprehenderit in voluptate.",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sherl",
  },
  {
    id: 3,
    name: "Alex Johnson",
    role: "Product Manager",
    date: "12th March, 2023",
    rating: 5,
    content: "Ut enim ad minim veniam, quis nostrud exercitation.",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
  },
];

export default function TestimonialsSection() {
  const [index, setIndex] = useState(0);
  const [cardsPerView, setCardsPerView] = useState(1);

  // ✅ Responsive detector
  useEffect(() => {
    const update = () => {
      setCardsPerView(window.innerWidth >= 768 ? 2 : 1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const maxIndex = Math.max(0, testimonials.length - cardsPerView);

  const next = () => {
    setIndex((i) => (i >= maxIndex ? 0 : i + 1));
  };

  const prev = () => {
    setIndex((i) => (i <= 0 ? maxIndex : i - 1));
  };

  return (
    <section className="py-20 bg-white dark:bg-slate-950 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        {/* HEADING */}
        <div className="text-center mb-16">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            What people{" "}
            <span className="text-red-500 relative inline-block">
              Think About Us
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-[3px] bg-red-500 rounded-full"></span>
            </span>
          </h2>
        </div>

        {/* SLIDER */}
        <div className="relative flex items-center">
          {/* LEFT */}
          <button
            onClick={prev}
            className="z-10 h-10 w-10 flex items-center justify-center rounded-full border dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-white"
          >
            <ChevronLeft />
          </button>

          {/* VIEWPORT */}
          <div className="overflow-hidden w-full mx-4">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{
                transform: `translateX(-${index * (100 / cardsPerView)}%)`,
              }}
            >
              {testimonials.map((item) => (
                <div
                  key={item.id}
                  className="w-full md:w-1/2 flex-shrink-0 px-3"
                >
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow border dark:border-slate-800 h-full">
                    {/* STARS */}
                    <div className="flex gap-1 text-orange-400 mb-3">
                      {Array.from({ length: item.rating }).map((_, i) => (
                        <Star key={i} size={16} fill="currentColor" />
                      ))}
                    </div>

                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                      {item.content}
                    </p>

                    <div className="flex items-center gap-4">
                      <img
                        src={item.image}
                        className="w-12 h-12 rounded-full"
                      />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {item.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {item.role}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT */}
          <button
            onClick={next}
            className="z-10 h-10 w-10 flex items-center justify-center rounded-full border dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-white"
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    </section>
  );
}
