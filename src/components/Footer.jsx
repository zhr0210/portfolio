import React from "react";

const Footer = () => {
    return (
        <footer id="scene-footer" className="scene-module absolute inset-0 opacity-0 bg-surface w-full py-12 lg:py-24 px-6 lg:px-12 flex flex-col justify-center">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-8 lg:gap-12 w-full">
                <div className="w-full md:w-1/2">
                    <div className="text-base lg:text-lg font-bold text-[#c6c6c7] mb-4 lg:mb-8 uppercase tracking-widest">联络 / CONTACT</div>
                    <div className="flex flex-col gap-4">
                        <button
                            className="w-full md:w-auto px-6 lg:px-12 py-4 lg:py-6 bg-[#fff6db] text-[#6b5d05] text-base lg:text-xl font-bold tracking-tight uppercase hover:bg-[#eeda7b] transition-all duration-300">
                            下载完整简历 (DOWNLOAD RESUME)
                        </button>
                        <button
                            className="w-full md:w-auto px-6 lg:px-12 py-4 lg:py-6 bg-transparent border border-[#767575]/40 text-[#c6c6c7] text-base lg:text-xl font-bold tracking-tight uppercase hover:text-[#ffffff] hover:border-[#ffffff] transition-all duration-300">
                            邮件邀约 (EMAIL ME)
                        </button>
                    </div>
                </div>
                <div className="flex flex-col gap-8 md:text-right w-full md:w-1/3">
                    <a className="font-['Inter'] text-[1rem] leading-relaxed text-[#acabaa] hover:text-[#ffffff] transition-opacity duration-300"
                        href="#">商务合作咨询 (Business Inquiry)</a>
                    <div className="flex md:justify-end gap-6 text-[#acabaa]">
                        <span className="material-symbols-outlined">public</span>
                        <span className="material-symbols-outlined">alternate_email</span>
                        <span className="material-symbols-outlined">share</span>
                    </div>
                </div>
            </div>
            <div
                className="max-w-7xl mx-auto mt-24 pt-12 border-t border-outline-variant/10 flex flex-col md:flex-row justify-between items-center gap-8 w-full">
                <div className="text-[#acabaa] text-xs uppercase tracking-[0.2em]">© 2024 Editorial Vanguard. 版权所有 / ALL RIGHTS RESERVED.</div>
                <div className="text-[#acabaa] text-xs uppercase tracking-[0.2em] flex gap-8">
                    <a className="hover:text-on-surface" href="#">隐私政策 / PRIVACY</a>
                    <a className="hover:text-on-surface" href="#">法律声明 / LEGAL</a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
