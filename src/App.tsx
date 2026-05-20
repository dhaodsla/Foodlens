import React, { useState, useRef, useEffect } from 'react';
import { Camera, ImagePlus, Loader2, Utensils, Droplets, Leaf, ChevronRight, RefreshCcw, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FoodData {
  foodName: string;
  totalCalories: number;
  caloriesPer100g: number;
  estimatedWeight: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
  description: string;
}

interface JournalEntry extends FoodData {
  id: string;
  timestamp: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'journal'>('scanner');
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FoodData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('foodlens_journal');
    if (saved) {
      try {
        setJournalEntries(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse journal entries from local storage', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('foodlens_journal', JSON.stringify(journalEntries));
  }, [journalEntries]);

  const addToJournal = () => {
    if (!result) return;
    const newEntry: JournalEntry = {
      ...result,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };
    setJournalEntries(prev => [newEntry, ...prev]);
    setActiveTab('journal');
    resetAll();
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaysEntries = journalEntries.filter(e => e.timestamp >= todayStart.getTime());
  
  const totalCal = todaysEntries.reduce((sum, e) => sum + e.totalCalories, 0);
  const totalProtein = todaysEntries.reduce((sum, e) => sum + e.protein, 0);
  const totalCarbs = todaysEntries.reduce((sum, e) => sum + e.carbs, 0);
  const totalFat = todaysEntries.reduce((sum, e) => sum + e.fat, 0);
  const dailyGoal = 2000;
  const calPercent = Math.min(100, (totalCal / dailyGoal) * 100);

  const handleCapture = () => {
    setActiveTab('scanner');
    fileInputRef.current?.click();
  };

  const handleGallery = () => {
    setActiveTab('scanner');
    galleryInputRef.current?.click();
  };

  const resetAll = () => {
    setImageUri(null);
    setResult(null);
    setError(null);
  };

  const fileToBase64 = (file: File): Promise<{base64: string, mimeType: string}> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 800;

          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
             reject(new Error('Canvas context is null'));
             return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          
          // Use jpeg for compression
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve({
            base64: dataUrl.split(',')[1],
            mimeType: 'image/jpeg'
          });
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input value so the same file could be selected again if needed
    event.target.value = '';

    const uri = URL.createObjectURL(file);
    setImageUri(uri);
    setResult(null);
    setError(null);
    setLoading(true);

    try {
      const { base64, mimeType } = await fileToBase64(file);

      const response = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });

      if (!response.ok) {
        throw new Error('음식 분석 중 오류가 발생했습니다.');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-stone-200 font-sans selection:bg-stone-500 selection:text-white pb-32 flex flex-col">
      {/* Hidden Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileSelected}
      />
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        className="hidden"
        onChange={onFileSelected}
      />

      {/* Header */}
      <header className="h-20 border-b border-stone-800 flex items-center justify-between px-6 md:px-10 shrink-0 bg-[#0A0A0A] fixed top-0 w-full z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-stone-100 rounded-full flex items-center justify-center">
            <div className="w-3 h-3 bg-black rounded-sm rotate-45"></div>
          </div>
          <span className="text-xl font-medium tracking-widest uppercase text-stone-200">FoodLens</span>
        </div>
        <div className="flex gap-6 sm:gap-8 text-xs font-semibold uppercase tracking-widest text-stone-500">
          <button 
            onClick={() => setActiveTab('scanner')} 
            className={`pb-1 border-b ${activeTab === 'scanner' ? 'text-stone-100 border-stone-100' : 'border-transparent hover:text-stone-300'}`}>Scanner</button>
          <button 
            onClick={() => setActiveTab('journal')} 
            className={`pb-1 border-b ${activeTab === 'journal' ? 'text-stone-100 border-stone-100' : 'border-transparent hover:text-stone-300'}`}>Journal</button>
        </div>
      </header>

      {activeTab === 'scanner' ? (
        <main className="max-w-4xl w-full mx-auto pt-28 px-4 flex flex-col gap-6">
          <AnimatePresence mode="wait">
          {!imageUri ? (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center py-20 gap-8"
            >
              <div className="text-center space-y-3">
                <div className="w-20 h-20 bg-stone-900 border border-stone-800 text-stone-400 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <Camera className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-light tracking-tight text-stone-100">어떤 음식을 드시나요?</h2>
                <p className="text-stone-500 text-sm max-w-[260px] mx-auto leading-relaxed">
                  음식 사진을 찍거나 갤러리에서 선택하면 인공지능이 칼로리를 분석해 드립니다.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="image-preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-full md:max-w-xl mx-auto aspect-square md:aspect-[4/3] rounded-sm overflow-hidden border border-stone-800 bg-stone-900 shadow-2xl"
            >
              <img src={imageUri} alt="Food to analyze" className="w-full h-full object-cover opacity-80" />
              
              <div className="absolute inset-0 bg-black/20"></div>
              <div className="absolute inset-6 sm:inset-10 border border-stone-100/30 rounded-lg pointer-events-none">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white"></div>
              </div>

              {loading && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center text-stone-200 z-10 transition-opacity">
                  <div className="relative flex items-center justify-center mb-4">
                    <Loader2 className="w-10 h-10 animate-spin absolute" />
                  </div>
                  <p className="font-semibold tracking-widest text-xs uppercase text-stone-300">음식 분석 중...</p>
                  <p className="text-[10px] text-stone-500 mt-2 font-mono uppercase tracking-widest">Processing neural network</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:max-w-xl mx-auto w-full bg-red-950/30 text-red-400 px-4 py-3 border border-red-900/50 flex items-center justify-between shadow-sm"
          >
            <span className="text-xs font-mono uppercase tracking-wider">{error}</span>
            <button onClick={resetAll} className="text-stone-300 hover:text-white uppercase tracking-widest text-[10px] font-bold">다시 시도</button>
          </motion.div>
        )}

        <AnimatePresence>
          {result && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Main Calories Card */}
              <div className="bg-[#0D0D0D] border border-stone-800 p-8 sm:p-10 flex flex-col md:max-w-2xl mx-auto w-full">
                <div className="mb-10">
                  <h3 className="text-xs font-semibold tracking-[0.2em] text-stone-500 uppercase mb-2">Analysis Result</h3>
                  <h2 className="text-4xl sm:text-5xl font-light italic serif text-stone-100 leading-tight mb-4" style={{ fontFamily: 'Georgia, serif' }}>{result.foodName}</h2>
                  <p className="text-stone-400 text-sm leading-relaxed max-w-sm">
                    {result.description}
                  </p>
                </div>

                <div className="flex flex-col border-b border-stone-800 pb-6 mb-8 gap-1">
                  <div className="flex items-baseline gap-4">
                    <span className="text-6xl sm:text-7xl font-thin tracking-tighter text-stone-100">{result.totalCalories.toLocaleString()}</span>
                    <span className="text-xl font-light text-stone-500 tracking-widest uppercase">kcal <span className="text-sm font-semibold normal-case text-stone-600">(총 추정량)</span></span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <div className="bg-stone-900 border border-stone-800 px-3 py-1.5 rounded-sm flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">100g당:</span>
                      <span className="text-sm text-stone-300 font-mono">{result.caloriesPer100g} kcal</span>
                    </div>
                    <div className="bg-stone-900 border border-stone-800 px-3 py-1.5 rounded-sm flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">총 제공량:</span>
                      <span className="text-sm text-stone-300 font-mono">{result.estimatedWeight}g</span>
                    </div>
                  </div>
                </div>

                {/* Macros */}
                <div className="grid grid-cols-3 gap-6 mb-10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-stone-500 tracking-widest uppercase mb-1">탄수화물 (Carbs)</span>
                    <span className="text-2xl text-stone-100">{result.carbs}g</span>
                    <div className="w-full h-1 bg-stone-800 mt-3">
                      <div className="h-full bg-stone-500" style={{ width: `${Math.min(100, (result.carbs / 300) * 100)}%` }}></div>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-stone-500 tracking-widest uppercase mb-1">단백질 (Protein)</span>
                    <span className="text-2xl text-stone-100">{result.protein}g</span>
                    <div className="w-full h-1 bg-stone-800 mt-3">
                      <div className="h-full bg-stone-300" style={{ width: `${Math.min(100, (result.protein / 200) * 100)}%` }}></div>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-stone-500 tracking-widest uppercase mb-1">지방 (Fat)</span>
                    <span className="text-2xl text-stone-100">{result.fat}g</span>
                    <div className="w-full h-1 bg-stone-800 mt-3">
                      <div className="h-full bg-stone-400" style={{ width: `${Math.min(100, (result.fat / 100) * 100)}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* Ingredients */}
                <div>
                  <h3 className="text-xs font-bold text-stone-500 tracking-widest uppercase mb-3 px-1">추정 성분</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.ingredients.map((ing, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-stone-900 border border-stone-800 text-stone-300 text-xs font-medium uppercase tracking-wider"
                      >
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Save Button */}
                <div className="mt-8 pt-8 border-t border-stone-800">
                  <button onClick={addToJournal} className="w-full py-5 bg-stone-100 text-black font-bold uppercase tracking-widest text-xs rounded-none hover:bg-stone-200 transition-colors flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" />
                    <span>Add to Journal</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      ) : (
        <main className="max-w-4xl w-full mx-auto pt-28 px-4 flex flex-col gap-6">
          <div className="bg-[#0D0D0D] border border-stone-800 p-8 sm:p-10 flex flex-col w-full">
            <h3 className="text-xs font-semibold tracking-[0.2em] text-stone-500 uppercase mb-2">Daily Summary</h3>
            <h2 className="text-4xl sm:text-5xl font-light italic serif text-stone-100 leading-tight mb-8" style={{ fontFamily: 'Georgia, serif' }}>Today's Intake</h2>
            
            <div className="flex flex-col border-b border-stone-800 pb-8 mb-8 gap-1">
              <div className="flex items-baseline gap-4">
                <span className="text-6xl sm:text-7xl font-thin tracking-tighter text-stone-100">{totalCal.toLocaleString()}</span>
                <span className="text-xl font-light text-stone-500 tracking-widest uppercase">/ {dailyGoal} kcal</span>
              </div>
              <div className="w-full h-2 bg-stone-800 mt-4 overflow-hidden rounded-full">
                <div className="h-full bg-stone-300 transition-all duration-1000" style={{ width: `${calPercent}%` }}></div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-stone-500 tracking-widest uppercase mb-1">Carbs</span>
                <span className="text-2xl text-stone-100">{totalCarbs}g</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-stone-500 tracking-widest uppercase mb-1">Protein</span>
                <span className="text-2xl text-stone-100">{totalProtein}g</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-stone-500 tracking-widest uppercase mb-1">Fat</span>
                <span className="text-2xl text-stone-100">{totalFat}g</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 mb-24">
            <h3 className="text-xs font-bold text-stone-500 tracking-widest uppercase mb-2 px-1">Meal History</h3>
            {todaysEntries.length === 0 ? (
              <div className="text-center py-12 text-stone-500 text-sm border border-stone-800 border-dashed bg-[#0A0A0A]">
                아직 기록된 식단이 없습니다.
              </div>
            ) : (
              todaysEntries.map(entry => (
                <div key={entry.id} className="bg-[#0D0D0D] border border-stone-800 p-5 flex items-center justify-between hover:border-stone-600 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-lg text-stone-100 font-medium mb-1">{entry.foodName}</span>
                    <span className="text-xs text-stone-500">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xl text-stone-100 font-thin">{entry.totalCalories}</span>
                    <span className="text-[10px] text-stone-500 uppercase tracking-widest">kcal</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      )}

      {/* Floating Action Buttons */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-stone-800 bg-[#050505] z-20 flex flex-col">
        <div className="w-full flex items-center justify-between p-4 px-6 gap-4">
          {imageUri ? (
            <button
              onClick={resetAll}
              disabled={loading}
              className="w-full max-w-sm mx-auto py-5 bg-stone-100 text-black font-bold uppercase tracking-widest text-xs rounded-none hover:bg-stone-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              <span>다른 사진 분석</span>
            </button>
          ) : (
            <div className="w-full max-w-sm mx-auto flex gap-4">
              <button
                onClick={handleGallery}
                disabled={loading}
                className="flex-1 py-5 bg-[#0D0D0D] border border-stone-800 text-stone-300 font-bold uppercase tracking-widest text-xs rounded-none hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
              >
                <ImagePlus className="w-4 h-4" />
                <span>갤러리</span>
              </button>
              <button
                onClick={handleCapture}
                disabled={loading}
                className="flex-1 py-5 bg-stone-100 text-black font-bold uppercase tracking-widest text-xs rounded-none hover:bg-stone-200 transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>음식 사진 찍기</span>
              </button>
            </div>
          )}
        </div>
        <div className="h-8 px-6 border-t border-stone-900 flex items-center justify-between text-[10px] font-mono text-stone-600 bg-[#000]">
          <span>FOODLENS // NEURAL_NET</span>
          <span className="flex items-center gap-2">
            <span className="w-1 h-1 bg-stone-600 rounded-full"></span>
            LATENCY: 42MS
          </span>
        </div>
      </footer>
    </div>
  );
}
