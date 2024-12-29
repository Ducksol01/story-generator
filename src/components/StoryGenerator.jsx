import { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

const StoryGenerator = () => {
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState('any');
  const [tone, setTone] = useState('neutral');
  const [keywords, setKeywords] = useState('');
  const [story, setStory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [storyLength, setStoryLength] = useState('medium');
  const [theme, setTheme] = useState('modern');
  const [characterDetails, setCharacterDetails] = useState('');
  const [storyHistory, setStoryHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // Speech related states
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [availableVoices, setAvailableVoices] = useState([]);
  const [speechRate, setSpeechRate] = useState(1);
  const speechSynthesis = window.speechSynthesis;
  const utteranceRef = useRef(null);
  const currentParagraphRef = useRef(0);

  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  useEffect(() => {
    const savedStories = localStorage.getItem('storyHistory');
    if (savedStories) {
      setStoryHistory(JSON.parse(savedStories));
    }

    // Initialize speech synthesis
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      setAvailableVoices(voices);
      setSelectedVoice(voices[0]?.name || '');
    };

    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Cleanup speech synthesis on unmount
    return () => {
      if (utteranceRef.current) {
        speechSynthesis.cancel();
      }
    };
  }, []);

  const stopSpeech = () => {
    speechSynthesis.cancel();
    setIsPlaying(false);
    currentParagraphRef.current = 0;
  };

  const speakStory = (startFromBeginning = true) => {
    if (startFromBeginning) {
      currentParagraphRef.current = 0;
    }

    if (!story) return;

    // Stop any ongoing speech
    speechSynthesis.cancel();

    const paragraphs = story.split('\n').filter(p => p.trim());
    if (currentParagraphRef.current >= paragraphs.length) {
      currentParagraphRef.current = 0;
    }

    const utterance = new SpeechSynthesisUtterance(paragraphs[currentParagraphRef.current]);
    utterance.rate = speechRate;
    
    const voice = availableVoices.find(v => v.name === selectedVoice);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => {
      currentParagraphRef.current++;
      if (currentParagraphRef.current < paragraphs.length && isPlaying) {
        speakStory(false);
      } else {
        setIsPlaying(false);
        currentParagraphRef.current = 0;
      }
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsPlaying(false);
    };

    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
    setIsPlaying(true);
  };

  const toggleSpeech = () => {
    if (isPlaying) {
      stopSpeech();
    } else {
      speakStory();
    }
  };

  const genres = [
    'Any', 'Fantasy', 'Science Fiction', 'Horror', 'Romance', 
    'Mystery', 'Thriller', 'Comedy', 'Adventure', 'Drama'
  ];

  const tones = [
    'Neutral', 'Funny', 'Dark', 'Romantic', 'Mysterious', 
    'Suspenseful', 'Inspirational', 'Dramatic', 'Whimsical'
  ];

  const lengths = [
    { value: 'short', label: 'Short (250 words)', icon: '📄' },
    { value: 'medium', label: 'Medium (500 words)', icon: '📑' },
    { value: 'long', label: 'Long (1000 words)', icon: '📚' }
  ];

  const themes = [
    { value: 'modern', label: 'Modern', icon: '🌆' },
    { value: 'medieval', label: 'Medieval', icon: '🏰' },
    { value: 'futuristic', label: 'Futuristic', icon: '🚀' },
    { value: 'dystopian', label: 'Dystopian', icon: '🌇' },
    { value: 'magical', label: 'Magical', icon: '✨' }
  ];

  const getThemeEmoji = () => {
    return themes.find(t => t.value === theme)?.icon || '📖';
  };

  const generateCharacterPrompt = () => {
    return `Create a brief character profile for the main character in this ${genre.toLowerCase()} story. Include name, age, and key traits.`;
  };

  const saveToHistory = (newStory) => {
    const updatedHistory = [
      { 
        date: new Date().toLocaleString(),
        story: newStory,
        prompt,
        genre,
        tone,
        theme
      },
      ...storyHistory
    ].slice(0, 10); // Keep only last 10 stories
    
    setStoryHistory(updatedHistory);
    localStorage.setItem('storyHistory', JSON.stringify(updatedHistory));
  };

  const exportStory = () => {
    const storyText = `
${getThemeEmoji()} Generated Story
Genre: ${genre}
Tone: ${tone}
Theme: ${theme}
Date: ${new Date().toLocaleString()}

${characterDetails ? `Character Details:\n${characterDetails}\n\n` : ''}
${story}
    `;

    const blob = new Blob([storyText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated-story-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateStory = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setCharacterDetails('');
    stopSpeech();
    
    if (!API_KEY) {
      setError('API key is missing. Please check your environment variables.');
      setLoading(false);
      return;
    }

    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      // Generate character details first
      const characterResult = await model.generateContent(generateCharacterPrompt());
      const characterProfile = await characterResult.response.text();
      setCharacterDetails(characterProfile);

      // Generate the main story
      const fullPrompt = `Generate a ${tone.toLowerCase()} story in the ${genre.toLowerCase()} genre.
        Setting: ${theme} world
        Story prompt: ${prompt}
        Keywords: ${keywords}
        Length: Approximately ${storyLength === 'short' ? '250' : storyLength === 'medium' ? '500' : '1000'} words
        Character to include: ${characterProfile}
        Make it engaging and well-structured.
        Format the story in clear paragraphs for easy reading.`;

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();
      setStory(text);
      saveToHistory(text);
    } catch (err) {
      console.error('Error details:', err);
      setError('Failed to generate story. Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderSpeechControls = () => (
    <div className="flex flex-wrap items-center gap-4 mt-4 p-4 bg-slate-50 rounded-lg">
      <button
        onClick={toggleSpeech}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        {isPlaying ? (
          <>
            <span>Pause</span> ⏸️
          </>
        ) : (
          <>
            <span>Play</span> ▶️
          </>
        )}
      </button>

      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-600">Voice:</label>
        <select
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          className="px-2 py-1 rounded border border-slate-200 text-sm"
        >
          {availableVoices.map((voice) => (
            <option key={voice.name} value={voice.name}>
              {voice.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-600">Speed:</label>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={speechRate}
          onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
          className="w-24"
        />
        <span className="text-sm text-slate-600">{speechRate}x</span>
      </div>

      <button
        onClick={stopSpeech}
        className="px-3 py-1 text-sm text-slate-600 hover:text-slate-900 transition-colors"
      >
        Stop ⏹️
      </button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="modern-card p-6 md:p-8 animate-fade-up">
        <form onSubmit={generateStory} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-lg font-medium text-slate-900">Story Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="input-modern"
              rows="4"
              placeholder="Write your story idea here..."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-lg font-medium text-slate-900">Genre</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="select-modern"
              >
                {genres.map((g) => (
                  <option key={g} value={g.toLowerCase()}>{g}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-lg font-medium text-slate-900">Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="select-modern"
              >
                {tones.map((t) => (
                  <option key={t} value={t.toLowerCase()}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-lg font-medium text-slate-900">Story Length</label>
              <select
                value={storyLength}
                onChange={(e) => setStoryLength(e.target.value)}
                className="select-modern"
              >
                {lengths.map((l) => (
                  <option key={l.value} value={l.value}>{l.icon} {l.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-lg font-medium text-slate-900">Theme</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="select-modern"
              >
                {themes.map((t) => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-lg font-medium text-slate-900">Keywords</label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="input-modern"
              placeholder="Enter keywords separated by commas"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="button-modern w-full"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
              </span>
            ) : `Generate Story ${getThemeEmoji()}`}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg animate-fade-up">
            {error}
          </div>
        )}

        {story && !error && (
          <div className="mt-8 animate-fade-up">
            <div className="modern-card p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="heading-2">Your Story {getThemeEmoji()}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={exportStory}
                    className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Export Story 📥
                  </button>
                </div>
              </div>

              {characterDetails && (
                <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Character Profile 👤</h3>
                  <p className="text-slate-600">{characterDetails}</p>
                </div>
              )}

              <div className="story-container">
                {story.split('\n').map((paragraph, index) => (
                  paragraph && (
                    <p key={index} className={`body-text mb-4 ${currentParagraphRef.current === index && isPlaying ? 'bg-blue-50 rounded p-2' : ''}`}>
                      {paragraph}
                    </p>
                  )
                ))}
              </div>

              {renderSpeechControls()}
            </div>
          </div>
        )}

        {/* Story History */}
        <div className="mt-8">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-slate-600 hover:text-slate-900 transition-colors"
          >
            {showHistory ? 'Hide History 📖' : 'Show History 📚'} ({storyHistory.length})
          </button>
          
          {showHistory && storyHistory.length > 0 && (
            <div className="mt-4 space-y-4">
              {storyHistory.map((item, index) => (
                <div key={index} className="modern-card p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm text-slate-500">{item.date}</div>
                    <div className="text-sm">
                      {item.genre} • {item.tone} • {themes.find(t => t.value === item.theme)?.icon}
                    </div>
                  </div>
                  <p className="text-slate-600 line-clamp-3">{item.story}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryGenerator;
