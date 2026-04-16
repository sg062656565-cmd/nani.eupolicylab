import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertCircle, 
  ChevronDown, 
  ChevronRight, 
  ChevronUp, 
  DoorOpen, 
  Lightbulb, 
  Loader2, 
  Navigation, 
  Send, 
  ShieldCheck, 
  Landmark, 
  Trophy, 
  UserCheck,
  UserCircle,
  Star
} from 'lucide-react';
import { CountryCode, Proposal, Message, GameState } from './types';
import { callAI } from './services/geminiService';
import { cn } from './lib/utils';

const COUNTRIES: Record<CountryCode, { name: string; color: string; icon: string }> = {
  DE: { name: '德國 (Germany)', color: 'bg-amber-600', icon: '🇩🇪' },
  GR: { name: '希臘 (Greece)', color: 'bg-blue-500', icon: '🇬🇷' },
  FR: { name: '法國 (France)', color: 'bg-blue-800', icon: '🇫🇷' },
  HU: { name: '匈牙利 (Hungary)', color: 'bg-green-700', icon: '🇭🇺' }
};

const EUFlag = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 120 80" className={className}>
    <rect width="120" height="80" fill="#003399" />
    <g transform="translate(60,40)">
      {[...Array(12)].map((_, i) => (
        <path
          key={i}
          fill="#FFDD00"
          d="M0,-24 L2.3,-16.7 L9.8,-16.7 L3.7,-12.3 L6,-5 L0,-9.4 L-6,-5 L-3.7,-12.3 L-9.8,-16.7 L-2.3,-16.7 Z"
          transform={`rotate(${i * 30})`}
        />
      ))}
    </g>
  </svg>
);

const RefugeeIllustration = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 400 200" className={className} fill="none">
    <path d="M0 160C100 140 100 180 200 160C300 140 300 180 400 160V200H0V160Z" fill="#1E3A8A" fillOpacity="0.4" />
    <path d="M0 170C80 160 120 190 200 170C280 150 320 180 400 170V200H0V170Z" fill="#1E40AF" fillOpacity="0.6" />
    <g transform="translate(150, 135) scale(0.8)">
      <path d="M10 30L90 30C100 30 110 40 105 50L85 70L15 70L0 50C-5 40 5 30 10 30Z" fill="#475569" />
      <path d="M30 30L35 10L65 10L70 30" stroke="#94A3B8" strokeWidth="2" />
      <circle cx="20" cy="25" r="4" fill="#94A3B8" />
      <circle cx="35" cy="22" r="4" fill="#94A3B8" />
      <circle cx="50" cy="25" r="4" fill="#94A3B8" />
      <circle cx="65" cy="22" r="4" fill="#94A3B8" />
      <circle cx="80" cy="25" r="4" fill="#94A3B8" />
    </g>
  </svg>
);

const HighlightedText = ({ text }: { text: string }) => {
  // Regex to find percentages, currency-like terms, and key phrases
  const keywords = [
    /(\d+%\s*的\s*配額)/g,
    /(\d+%\s*配額)/g,
    /(全額補助)/g,
    /(強制配額)/g,
    /(財務支持)/g,
    /(邊境管控)/g,
    /(財政紀律)/g,
    /(主權)/g
  ];

  let parts: (string | React.ReactNode)[] = [text];

  keywords.forEach(regex => {
    const newParts: (string | React.ReactNode)[] = [];
    parts.forEach(part => {
      if (typeof part === 'string') {
        const subParts = part.split(regex);
        const matches = part.match(regex);
        let matchIdx = 0;
        subParts.forEach((subPart, i) => {
          newParts.push(subPart);
          if (i < subParts.length - 1 && matches) {
            newParts.push(
              <span key={`${i}-${matchIdx}`} className="text-yellow-400 font-bold underline decoration-yellow-400/30">
                {matches[matchIdx++]}
              </span>
            );
          }
        });
      } else {
        newParts.push(part);
      }
    });
    parts = newParts;
  });

  return <>{parts}</>;
};

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || "");
  const [gameState, setGameState] = useState<GameState>('setup');
  const [messages, setMessages] = useState<Message[]>([]);
  const [proposal, setProposal] = useState<Proposal>({ borderControl: 50, quotaMandatory: 30, financialSupport: 40 });
  const [agreementLevels, setAgreementLevels] = useState<Record<CountryCode, number>>({ DE: 50, GR: 50, FR: 50, HU: 50 });
  const [userInput, setUserInput] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isFocusOpen, setIsFocusOpen] = useState(true);
  const [hasProposed, setHasProposed] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(1);
  const [showConfessional, setShowConfessional] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [responseQueue, setResponseQueue] = useState<Message[]>([]);
  const [isQueueActive, setIsQueueActive] = useState(false);
  const [patience, setPatience] = useState(100);

  const scrollRef = useRef<HTMLDivElement>(null);
  const agendaTitle = "《移民與庇護公約》";

  const COUNTRIES_EXTENDED: Record<CountryCode, { name: string; color: string; icon: string; demand: string; demandIcon: string }> = {
    DE: { name: '德國', color: 'bg-amber-600', icon: '🇩🇪', demand: '財政紀律', demandIcon: '⚖️' },
    GR: { name: '希臘', color: 'bg-blue-500', icon: '🇬🇷', demand: '要求補貼', demandIcon: '💰' },
    FR: { name: '法國', color: 'bg-blue-800', icon: '🇫🇷', demand: '歐洲整合', demandIcon: '🇪🇺' },
    HU: { name: '匈牙利', color: 'bg-green-700', icon: '🇭🇺', demand: '主權優先', demandIcon: '🛡️' }
  };

  const getEmotion = (level: number) => {
    if (level >= 80) return { label: '極度滿意', icon: '🤩', color: 'text-green-400' };
    if (level >= 60) return { label: '滿意', icon: '😊', color: 'text-green-300' };
    if (level >= 40) return { label: '猶豫', icon: '😐', color: 'text-yellow-400' };
    if (level >= 20) return { label: '不滿', icon: '😟', color: 'text-orange-400' };
    return { label: '憤怒', icon: '😡', color: 'text-red-500' };
  };

  const tutorialContent = [
    { title: "幕僚長報告：身分確認", text: "主席，希臘的防線瀕臨瓦解，歐盟正處於分裂的邊緣。您必須在人道責任與邊境安全之間做出關鍵抉擇，以維護歐盟的團結。" },
    { title: "顧問提示：外交手段", text: "利用下方的對話建議或自行輸入外交聲明。記住，您的每一句話都會影響各國代表的心理預期。" },
    { title: "戰略分析：邊境管控", text: "外部邊境管控強度是匈牙利的底線。強度越高可安撫主權派，但會引起人道組織與前線國家的強烈抗議。" },
    { title: "戰略分析：團結配額", text: "強制配額決定難民是否能在全歐分流。希臘極度支持此項以減輕壓力，但匈牙利視其為對主權的嚴重侵犯。" },
    { title: "戰略分析：財務補償", text: "由歐盟共同預算支付收容費用。這對前線國家是生存關鍵，但出資國如德國會要求極其嚴格的預算監管。" },
    { title: "最終指令：達成共識", text: "先拋出議題觀察各國反應，再精確調整右側參數。當四國支持度皆高於 60% 時，歷史將記住您的決斷。" }
  ];

  const dynamicSuggestions = [
    "我們必須在人道責任與邊境安全之間取得平衡。",
    "我提議增加對前線國家的財務支持，以換取更嚴格的篩選。",
    "強制配額是展現歐洲團結的唯一方式。",
    "我們應該尊重各國主權，尋求自願性的分流方案。"
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSimulating]);

  const calculateAgreement = (p: Proposal) => {
    const levels: Record<CountryCode, number> = { DE: 50, GR: 50, FR: 50, HU: 50 };
    
    // DE: 德國 - 重視財政紀律與邊境篩選
    levels.DE = Math.min(Math.max(Math.round(50 + (p.borderControl - 50) * 0.8 + (p.quotaMandatory - 30) * 0.3 - (p.financialSupport - 40) * 0.5), 0), 100);
    
    // GR: 希臘 - 前線國家，要求配額與補助
    levels.GR = Math.min(Math.max(Math.round(50 + (p.quotaMandatory - 30) * 1.6 + (p.financialSupport - 40) * 1.2 - (p.borderControl - 50) * 0.4), 0), 100);
    
    // HU: 匈牙利 - 主權主義，反對配額，支持邊境
    levels.HU = Math.min(Math.max(Math.round(50 + (p.borderControl - 50) * 1.8 - (p.quotaMandatory - 30) * 2.5), 0), 100);
    
    // FR: 法國 - 尋求折衷
    levels.FR = Math.min(Math.max(Math.round(50 + (p.borderControl - 50) * 0.4 + (p.financialSupport - 40) * 0.4 + (p.quotaMandatory - 30) * 0.4), 0), 100);
    
    return levels;
  };

  const handleSendMessage = async (e?: React.FormEvent, custom?: string) => {
    if (e) e.preventDefault();
    const text = custom || userInput;
    if (!text.trim() || isQueueActive || isSimulating) return;

    setShowSuggestions(false);
    setMessages(prev => [...prev, { role: 'mediator', content: text }]);
    setUserInput('');
    setIsSimulating(true);

    // Deduct patience for each negotiation turn
    setPatience(p => Math.max(0, p - 5));

    const levels = calculateAgreement(proposal);
    setAgreementLevels(levels);

    const queue: Message[] = [];
    const codes: CountryCode[] = ['GR', 'HU', 'DE', 'FR'];
    
    try {
      for (const c of codes) {
        const resp = await callAI(c, text, proposal, apiKey);
        queue.push({ role: 'ai', country: c, content: resp });
      }

      setIsSimulating(false);
      
      if (Object.values(levels).every(v => v >= 60)) {
        setShowSuccessModal(true);
      } else if (Object.values(levels).filter(v => v < 35).length >= 2) {
        setShowConfessional(true);
        setResponseQueue(queue);
        setIsQueueActive(true);
      } else {
        setResponseQueue(queue);
        setIsQueueActive(true);
        setHasProposed(true);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("Simulation error:", error);
      setIsSimulating(false);
      setMessages(prev => [...prev, { role: 'system', content: "通訊系統發生錯誤，請檢查您的 API Key 是否正確。" }]);
    }
  };

  const showNext = () => {
    if (responseQueue.length === 0) return;
    const [n, ...r] = responseQueue;
    setMessages(p => [...p, n]);
    setResponseQueue(r);
    if (r.length === 0) setIsQueueActive(false);
  };

  useEffect(() => {
    if (responseQueue.length > 0 && !isQueueActive) {
      setIsQueueActive(true);
      const processQueue = async () => {
        const queueCopy = [...responseQueue];
        for (const msg of queueCopy) {
          await new Promise(resolve => setTimeout(resolve, 800)); // Reduced delay for faster negotiation
          setMessages(prev => [...prev, msg]);
        }
        setResponseQueue([]);
        setIsQueueActive(false);
      };
      processQueue();
    }
  }, [responseQueue, isQueueActive]);

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey);
      setGameState('intro');
    }
  };

  if (gameState === 'setup') return (
    <div className="min-h-screen flex items-center justify-center p-6 text-slate-200">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-slate-900 border border-blue-500/20 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden glass-morphism"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-yellow-500 to-blue-600"></div>
        <h1 className="text-3xl font-black text-white text-center mb-8">AI 實驗室環境配置</h1>
        <div className="space-y-6">
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 text-xs leading-loose">
            <h2 className="text-yellow-500 font-bold mb-2">如何取得 API Key?</h2>
            <ol className="list-decimal ml-4 space-y-1">
              <li>前往 Google AI Studio 網站。</li>
              <li>登入 Google 帳號並點擊 「Get API key」。</li>
              <li>複製產生的金鑰並貼在下方。</li>
            </ol>
          </div>
          <input 
            type="password" 
            value={apiKey} 
            onChange={e => setApiKey(e.target.value)} 
            placeholder="請輸入 Gemini API Key..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-6 py-4 focus:ring-2 focus:ring-blue-500 text-slate-100 outline-none"
          />
          <button 
            onClick={saveApiKey} 
            className="w-full bg-blue-600 py-5 rounded-2xl font-black text-xl hover:bg-blue-500 transition-colors"
          >
            進入實驗室
          </button>
        </div>
      </motion.div>
    </div>
  );

  if (gameState === 'intro') return (
    <div className="min-h-screen flex items-center justify-center p-6 text-slate-100">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-6xl w-full bg-slate-900 border border-blue-500/30 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col md:flex-row glass-morphism"
      >
        <div className="md:w-1/2 p-10 bg-gradient-to-br from-[#003399]/40 to-slate-900 flex flex-col justify-center">
          <EUFlag className="w-16 h-10 mb-8 rounded" />
          <h1 className="text-4xl font-black mb-6 leading-tight text-white">歐盟政策實驗室：<br/><span className="text-[#FFDD00]">國家自主權與共同政策的矛盾</span></h1>
          <p className="text-slate-300 text-sm leading-relaxed">2011年敘利亞內戰爆發，難民潮席捲歐洲。你將扮演高峰會主席，在主權堡壘與人道團結間尋求各國共識。失敗將導致歐盟分裂，成功則締造歷史。</p>
        </div>
        <div className="md:w-1/2 p-10 bg-slate-900/80 flex flex-col justify-center items-center">
          <RefugeeIllustration className="w-full opacity-60 mb-8" />
          <button 
            onClick={() => { setGameState('lab'); setShowTutorial(true); }} 
            className="w-full bg-[#FFDD00] text-[#003399] font-black py-6 rounded-2xl text-2xl active:scale-95 transition-all hover:bg-yellow-400"
          >
            馬上進入會議
          </button>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="flex h-screen w-full flex-col relative text-slate-100 bg-transparent overflow-hidden">
      {/* 耐性耗盡彈窗 */}
      <AnimatePresence>
        {patience <= 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-6 text-center"
          >
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="max-w-xl bg-slate-900 border-4 border-red-500 rounded-[3rem] p-12 shadow-2xl"
            >
              <AlertCircle size={64} className="text-red-500 mb-6 mx-auto" />
              <h2 className="text-5xl font-black mb-6 text-white">談判破裂！</h2>
              <p className="text-xl mb-10 text-red-100">代表團的耐性已耗盡。由於您遲遲無法提出令各方滿意的方案，各國代表已全數離席，會議宣告失敗。</p>
              <button onClick={() => window.location.reload()} className="w-full bg-red-600 text-white font-black py-6 rounded-2xl text-2xl hover:bg-red-500 transition-colors">重新嘗試調解</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 成功彈窗 */}
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-6 text-center"
          >
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="max-w-xl bg-slate-900 border-4 border-yellow-500 rounded-[3rem] p-12 shadow-2xl"
            >
              <Trophy size={64} className="text-yellow-500 mb-6 mx-auto" />
              <h2 className="text-5xl font-black mb-6 text-white">決議成功！</h2>
              <p className="text-xl mb-10 text-blue-100">恭喜主席！在您的調解下，各國終於達成共識通過了<span className="text-yellow-500 font-bold underline px-2">{agendaTitle}</span>。</p>
              <button onClick={() => window.location.reload()} className="w-full bg-yellow-500 text-blue-900 font-black py-6 rounded-2xl text-2xl hover:bg-yellow-400 transition-colors">重新開始實驗</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 告解室 */}
      <AnimatePresence>
        {showConfessional && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center p-6 text-center"
          >
            <motion.div 
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              className="max-w-2xl bg-slate-900 border-2 border-amber-500 rounded-3xl p-10 shadow-2xl"
            >
              <DoorOpen size={48} className="text-amber-500 mb-6 mx-auto" />
              <h2 className="text-3xl font-black text-amber-500 mb-6">談判死局：啟動「告解室」</h2>
              <p className="text-amber-100 text-lg mb-10">多國代表已離席抗議！主席必須進入私下協商模式，一對一探尋底線。目前參數配置在公開會議中絕對無法通過。</p>
              <button onClick={() => setShowConfessional(false)} className="w-full bg-yellow-500 text-blue-900 font-black py-6 rounded-2xl text-2xl hover:bg-yellow-400 transition-colors">已了解，將會修改政策</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 引導系統 */}
      <AnimatePresence>
        {showTutorial && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-2xl w-full glass-panel rounded-none border-t-4 border-blue-500 p-10 relative scanline animate-flicker"
            >
              <div className="absolute top-4 right-4 flex gap-2">
                <Star size={16} className="text-blue-500/50" />
                <Star size={16} className="text-blue-500/50" />
              </div>
              <div className="flex gap-8 items-start mb-8">
                <div className="shrink-0 bg-blue-900/50 p-4 border border-blue-500/30 rounded-full">
                  <UserCircle size={64} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-blue-400 uppercase tracking-[0.3em] mb-2">當前任務狀態</h2>
                  <h3 className="text-3xl font-black text-white mb-4">{tutorialContent[tutorialStep-1].title}</h3>
                  <div className="h-1 w-20 bg-blue-500 mb-6" />
                </div>
              </div>
              
              <div className="bg-slate-950/50 p-8 border-l-4 border-blue-500 text-xl leading-[1.8] text-slate-100 mb-10 font-medium">
                {tutorialContent[tutorialStep-1].text}
              </div>

              <div className="flex gap-4">
                {tutorialStep > 1 && (
                  <button 
                    onClick={() => setTutorialStep(s => s - 1)} 
                    className="flex-1 border-2 border-blue-500/30 py-4 text-blue-400 font-black hover:bg-blue-500/10 transition-colors uppercase tracking-widest"
                  >
                    回溯報告
                  </button>
                )}
                <button 
                  onClick={() => tutorialStep < 6 ? setTutorialStep(s => s + 1) : setShowTutorial(false)} 
                  className="flex-[2] bg-blue-600 py-4 text-white font-black text-xl hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] uppercase tracking-widest"
                >
                  {tutorialStep < 6 ? '確認並繼續' : '正式主持會議'}
                </button>
              </div>
              <div className="mt-6 flex justify-between items-center text-[10px] font-black text-blue-500/50 uppercase tracking-widest">
                <span>EU-PRESIDENCY-PROTOCOL-v5.1</span>
                <span>STEP {tutorialStep}/06</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="h-24 bg-blue-900/40 border-b border-blue-500/30 flex items-center px-8 gap-8 shrink-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-6 w-full md:w-auto border-r border-blue-500/20 pr-8">
          <EUFlag className="w-12 h-8 rounded shadow shrink-0" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-blue-200 tracking-widest">代表團耐性</span>
            <div className="w-32 h-2.5 bg-slate-800 rounded-full mt-2 overflow-hidden border border-blue-500/20">
              <motion.div 
                animate={{ width: `${patience}%`, backgroundColor: patience < 30 ? '#ef4444' : '#3b82f6' }}
                className="h-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              />
            </div>
          </div>
        </div>
        <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {(Object.keys(COUNTRIES_EXTENDED) as CountryCode[]).map((code) => {
            const emotion = getEmotion(agreementLevels[code]);
            return (
              <div key={code} className={cn(
                "flex flex-col justify-center p-3 rounded-xl transition-all duration-500 border border-transparent",
                agreementLevels[code] < 20 ? "animate-breathing-red bg-red-500/10" : "bg-blue-500/5"
              )}>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-black text-white flex items-center gap-2">
                    <span className="text-xl">{COUNTRIES_EXTENDED[code].icon}</span>
                    <span className="tracking-tight">{COUNTRIES_EXTENDED[code].name}</span>
                    <span className="opacity-40">{COUNTRIES_EXTENDED[code].demandIcon}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xl font-black tracking-tighter", emotion.color)}>
                      {agreementLevels[code]}%
                    </span>
                    <span className="text-lg">{emotion.icon}</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${agreementLevels[code]}%` }}
                    transition={{ duration: 1 }}
                    className={cn(
                      "h-full transition-all",
                      agreementLevels[code] > 60 ? 'bg-green-500' : agreementLevels[code] > 35 ? 'bg-yellow-500' : 'bg-red-500'
                    )} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <main className="flex-1 flex flex-col bg-transparent border-r border-blue-500/10 overflow-hidden relative">
          <div className="flex-1 overflow-y-auto p-8 md:p-14 space-y-12 custom-scrollbar pb-40" ref={scrollRef}>
            {messages.map((m, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, x: m.role === 'mediator' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn("flex", m.role === 'mediator' ? 'justify-end' : 'justify-start')}
              >
                <div className={cn(
                  "max-w-[90%] md:max-w-[85%] rounded-[2.5rem] p-8 md:p-12 border shadow-2xl backdrop-blur-lg",
                  m.role === 'system' ? 'bg-yellow-500/5 border-yellow-500/10 text-yellow-500/80 text-sm w-full text-center' : 
                  m.role === 'mediator' ? 'bg-blue-600/80 text-white border-blue-400/30' : 
                  'bg-slate-800/30 border-slate-700/50 text-slate-100'
                )}>
                  {m.role === 'ai' && m.country && (
                    <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-6">
                      <div className="flex items-center gap-5">
                        <span className="text-4xl">{COUNTRIES_EXTENDED[m.country].icon}</span>
                        <div className="flex flex-col">
                          <span className="text-2xl font-black text-white tracking-tight">{COUNTRIES_EXTENDED[m.country].name} 代表</span>
                          <span className="text-sm font-bold text-yellow-500 flex items-center gap-2 mt-1">
                            <span className="bg-yellow-500/20 px-2 py-0.5 rounded text-[10px] uppercase">核心要求</span>
                            {COUNTRIES_EXTENDED[m.country].demandIcon} {COUNTRIES_EXTENDED[m.country].demand}
                          </span>
                        </div>
                      </div>
                      <div className={cn("px-5 py-2 rounded-2xl bg-black/40 text-sm font-black flex items-center gap-2 border border-white/5", getEmotion(agreementLevels[m.country]).color)}>
                        <span className="text-xl">{getEmotion(agreementLevels[m.country]).icon}</span>
                        {getEmotion(agreementLevels[m.country]).label}
                      </div>
                    </div>
                  )}
                  {m.role === 'mediator' && <div className="text-xs font-black uppercase mb-6 text-blue-200 underline tracking-[0.2em]">主席 外交聲明</div>}
                  <p className="text-lg md:text-2xl leading-[1.8] whitespace-pre-wrap text-white font-medium">
                    {m.role === 'ai' ? <HighlightedText text={m.content} /> : m.content}
                  </p>
                </div>
              </motion.div>
            ))}
            {isSimulating && (
              <div className="flex justify-start items-center gap-4 bg-slate-800/30 backdrop-blur-md rounded-full px-8 py-4 border border-slate-700/50 w-fit">
                <Loader2 size={20} className="animate-spin text-blue-400" />
                <span className="text-xs font-black text-slate-300">代表團密集協商中...</span>
              </div>
            )}
            {isQueueActive && responseQueue.length > 0 && (
              <div className="flex justify-center pt-10">
                <button 
                  onClick={showNext} 
                  className="bg-transparent border-2 border-yellow-500 text-yellow-500 px-12 py-6 rounded-[2rem] font-black text-xl flex items-center gap-5 shadow-2xl animate-pulse hover:bg-yellow-500/10 transition-colors"
                >
                  <UserCheck size={28} /> 下一位發言：{COUNTRIES[responseQueue[0].country as CountryCode].name} <ChevronRight size={28} />
                </button>
              </div>
            )}
          </div>

          <div className={cn(
            "p-8 bg-blue-900/20 backdrop-blur-xl border-t border-blue-500/20 transition-all duration-700 z-10",
            isQueueActive ? 'opacity-0 h-0 p-0 pointer-events-none' : 'opacity-100 h-auto'
          )}>
            <div className="max-w-4xl mx-auto space-y-6">
              {showSuggestions && (
                <div className="flex flex-wrap gap-2.5">
                  {dynamicSuggestions.map((s, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => handleSendMessage(undefined, s)} 
                      className="text-[11px] bg-blue-900/30 backdrop-blur-md border border-blue-500/30 px-5 py-2.5 rounded-full text-blue-100 hover:bg-blue-800 transition-colors flex items-center"
                    >
                      <Lightbulb size={14} className="text-yellow-500 mr-2" /> {s}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex gap-5 relative group">
                <input 
                  type="text" 
                  value={userInput} 
                  onChange={e => setUserInput(e.target.value)} 
                  disabled={isQueueActive || isSimulating || showConfessional || showSuccessModal} 
                  placeholder={hasProposed ? "發表外交調解聲明以說服各方..." : "主席，請輸入您的初步聲明以開啟正式會議..."}
                  className="relative flex-1 bg-slate-900/50 backdrop-blur-md border-2 border-blue-500/30 rounded-3xl px-8 py-5 focus:ring-4 focus:ring-yellow-500/20 text-lg text-white shadow-inner outline-none"
                />
                <button 
                  type="submit" 
                  disabled={isSimulating || isQueueActive || !userInput.trim()} 
                  className="relative bg-yellow-400 text-blue-950 px-12 rounded-3xl font-black shadow-xl hover:bg-yellow-300 transition-colors disabled:opacity-50"
                >
                  <Send size={26} />
                </button>
              </form>
            </div>
          </div>
        </main>

        <aside className={cn(
          "w-[30rem] bg-blue-900/10 backdrop-blur-md flex flex-col p-12 shrink-0 border-l border-blue-500/20 transition-all duration-500",
          (!hasProposed || showConfessional || showSuccessModal) ? 'opacity-30 grayscale pointer-events-none' : 'opacity-100'
        )}>
          <h2 className="text-2xl font-black mb-14 text-white leading-tight border-l-4 border-yellow-500 pl-6">主席決策面板：<br/><span className="text-slate-400 text-sm font-medium">請平衡各國利益以達成共識</span></h2>
          <div className="space-y-20 flex-1 overflow-y-auto custom-scrollbar pr-4">
            {[
              { label: '外部邊境管控強度', key: 'borderControl' as const, icon: Navigation, left: '人道通行', right: '歐洲堡壘', info: '強度越高可安撫匈牙利，但前線國家會抗議。' },
              { label: '強制團結配額', key: 'quotaMandatory' as const, icon: ShieldCheck, left: '自願原則', right: '強制配額', info: '決定難民是否分流。希臘支持，匈牙利拒絕。' },
              { label: '前線財務補償', key: 'financialSupport' as const, icon: Landmark, left: '預算自理', right: '歐盟補助', info: '由歐盟預算支付收容費用。對前線極重要。' }
            ].map(item => (
              <div key={item.key} className="space-y-8 group relative">
                <div className="flex justify-between items-center relative">
                  <label className="text-lg font-black text-white flex items-center gap-4 hover:text-yellow-400 cursor-help transition-colors">
                    <item.icon size={24} className="text-blue-400" /> {item.label}
                    <div className="absolute bottom-full left-0 mb-6 w-80 bg-slate-900 border-t-4 border-yellow-500 p-6 rounded-3xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 text-sm leading-relaxed text-blue-50 border border-white/10">
                      {item.info}
                    </div>
                  </label>
                  <span className="text-xl font-black bg-slate-950 px-4 py-2 rounded-2xl text-yellow-400 border border-blue-500/30 shadow-inner">{proposal[item.key]}%</span>
                </div>
                <input 
                  type="range" 
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none accent-yellow-400 cursor-pointer" 
                  value={proposal[item.key]} 
                  onChange={e => setProposal({...proposal, [item.key]: parseInt(e.target.value)})} 
                />
                <div className="flex justify-between text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
                  <span>{item.left}</span>
                  <span>{item.right}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-12 border-t border-blue-900/20 text-center">
            <button 
              onClick={() => handleSendMessage(undefined, "主席正式發布最新政策修正，請代表審議。")} 
              disabled={isSimulating || isQueueActive || !hasProposed} 
              className="w-full bg-yellow-400 text-blue-950 font-black py-7 rounded-3xl shadow-[0_0_30px_rgba(250,204,21,0.3)] text-2xl active:scale-95 hover:bg-yellow-300 transition-all disabled:opacity-50 uppercase tracking-widest"
            >
              發布政策修正
            </button>
            <div className="mt-6 flex justify-center items-center gap-3 opacity-40">
              <Star size={10} className="text-blue-400" />
              <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.4em] scanline">Consilium Lab v5.1</p>
              <Star size={10} className="text-blue-400" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
