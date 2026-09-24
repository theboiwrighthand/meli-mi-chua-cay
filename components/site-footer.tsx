import { ExternalLink, MapPin, Phone } from "lucide-react";

const mapSrc = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3723.7688664832754!2d105.79073577596986!3d21.041932287324663!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3135ab0e70774da1%3A0x47c2f6c94a594006!2sM%E1%BB%B3%20Chua%20Cay%20Meli!5e0!3m2!1svi!2s!4v1790269382949!5m2!1svi!2s";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#723a2c] bg-[#2e1b17] text-[#fff7ec]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12 lg:px-8">
        <div>
          <p className="text-2xl font-extrabold tracking-wide">MELI</p>
          <p className="mt-1 text-sm font-medium text-[#f2c79b]">Mì chua cay</p>
          <address className="mt-7 space-y-5 not-italic">
            <div className="flex items-start gap-3">
              <MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#f3bc77]" />
              <div>
                <p className="font-semibold">Địa chỉ</p>
                <p className="mt-1 leading-relaxed text-[#f4e5d8]">106-C4 Nghĩa Tân - Cầu Giấy (Đối diện 215 Tô Hiệu)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#f3bc77]" />
              <div>
                <p className="font-semibold">Ship</p>
                <a className="mt-1 inline-block rounded-sm text-[#f4e5d8] underline decoration-[#f3bc77] underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f3bc77]" href="tel:0353871196">0353871196</a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ExternalLink aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#f3bc77]" />
              <div>
                <p className="font-semibold">Facebook</p>
                <a className="mt-1 inline-block break-all rounded-sm text-[#f4e5d8] underline decoration-[#f3bc77] underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f3bc77]" href="https://www.facebook.com/michuacaymeli" target="_blank" rel="noopener noreferrer">Mì Chua Cay Meli</a>
              </div>
            </div>
          </address>
        </div>
        <div>
          <h2 className="mb-4 text-lg font-bold">Tìm quán trên bản đồ</h2>
          <div className="overflow-hidden rounded-2xl bg-[#47302a]">
            <iframe
              title="Bản đồ Mì Chua Cay Meli tại 106-C4 Nghĩa Tân, Cầu Giấy"
              src={mapSrc}
              width="600"
              height="450"
              className="aspect-[4/3] w-full border-0 sm:aspect-[16/9]"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
