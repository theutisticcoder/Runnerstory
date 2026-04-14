import React, { useState, useEffect, useRef } from ‘react’;
import { Volume2, MapPin, Save, Share2, Play, Square, ChevronDown, Settings } from ‘lucide-react’;

const RunAdventureApp = () => {
// Auth & Data
const [currentUser, setCurrentUser] = useState(null);
const [showAuthModal, setShowAuthModal] = useState(true);
const [authMode, setAuthMode] = useState(‘login’);
const [email, setEmail] = useState(’’);
const [password, setPassword] = useState(’’);

// Adventure State
const [gameState, setGameState] = useState(null);
const [isRunning, setIsRunning] = useState(false);
const [selectedGenre, setSelectedGenre] = useState(null);
const [currentLocation, setCurrentLocation] = useState(null);
const [previousLocation, setPreviousLocation] = useState(null);
const [routeHistory, setRouteHistory] = useState([]);

// Story State
const [currentChapter, setCurrentChapter] = useState(null);
const [storyLog, setStoryLog] = useState([]);
const [choices, setChoices] = useState([]);
const [isGenerating, setIsGenerating] = useState(false);
const [isAudioPlaying, setIsAudioPlaying] = useState(false);
const [audioUrl, setAudioUrl] = useState(null);
const [nearbyIntersections, setNearbyIntersections] = useState([]);
const [detectedIntersection, setDetectedIntersection] = useState(null);
const [choicesVisible, setChoicesVisible] = useState(false);

// Geolocation
const watchIdRef = useRef(null);
const audioRef = useRef(null);
const lastIntersectionRef = useRef(null);

const MISTRAL_API_KEY = ‘nrayQwviJ8l6nyTdq5mTweYgrgnrz6DZ’;
const MISTRAL_TTS_VOICE = ‘en_paul_neutral’;
const MISTRAL_TTS_MODEL = ‘voxtral-mini-tts-2603’;
const LOCATION_UPDATE_INTERVAL = 5000;
const INTERSECTION_DETECTION_RADIUS = 50;
const GENRES = [‘fantasy’, ‘sci-fi’, ‘mystery’, ‘horror’, ‘adventure’];

// ==================== AUTH ====================
const handleAuth = async (e) => {
e.preventDefault();
const users = JSON.parse(localStorage.getItem(‘runUsers’) || ‘[]’);

```
if (authMode === 'signup') {
  if (users.find(u => u.email === email)) {
    alert('Email already registered!');
    return;
  }
  const newUser = { id: Date.now(), email, password, adventures: [] };
  users.push(newUser);
  localStorage.setItem('runUsers', JSON.stringify(users));
  setCurrentUser(newUser);
} else {
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    alert('Invalid credentials!');
    return;
  }
  setCurrentUser(user);
}
setShowAuthModal(false);
setEmail('');
setPassword('');
```

};

const handleLogout = () => {
setCurrentUser(null);
setGameState(null);
setSelectedGenre(null);
setIsRunning(false);
setShowAuthModal(true);
};

// ==================== GEOLOCATION ====================
const startTracking = () => {
if (!navigator.geolocation) {
alert(‘Geolocation not supported’);
return;
}

```
setIsRunning(true);
watchIdRef.current = navigator.geolocation.watchPosition(
  (position) => {
    const newLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: Date.now(),
      accuracy: position.coords.accuracy
    };
    
    setCurrentLocation(newLocation);
    checkForIntersection(newLocation);
    updateRouteHistory(newLocation);
  },
  (error) => console.error('Geolocation error:', error),
  { enableHighAccuracy: true, maximumAge: 0 }
);
```

};

const stopTracking = () => {
if (watchIdRef.current) {
navigator.geolocation.clearWatch(watchIdRef.current);
}
setIsRunning(false);
};

const updateRouteHistory = (location) => {
setRouteHistory(prev => […prev, location]);
};

// ==================== INTERSECTION DETECTION ====================
const getIntersections = (lat, lng) => {
const osmQuery = `[bbox:${lng-0.005},${lat-0.005},${lng+0.005},${lat+0.005}]; (way["highway"];); out geom;`;

```
return fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  body: osmQuery
})
  .then(r => r.json())
  .catch(() => ({ elements: [] }));
```

};

const checkForIntersection = async (location) => {
if (!previousLocation) {
setMockNearbyIntersections(location);
setPreviousLocation(location);
return;
}

```
const distance = calculateDistance(location.lat, location.lng, previousLocation.lat, previousLocation.lng);

if (distance > 0.003) {
  setMockNearbyIntersections(location);
  setPreviousLocation(location);
  
  if (!lastIntersectionRef.current || !isChoicesVisible) {
    await triggerIntersectionDecision(location);
  }
}
```

};

const calculateDistance = (lat1, lng1, lat2, lng2) => {
const R = 6371;
const dLat = (lat2 - lat1) * Math.PI / 180;
const dLng = (lng2 - lng1) * Math.PI / 180;
const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
Math.sin(dLng / 2) * Math.sin(dLng / 2);
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
return c * R;
};

const setMockNearbyIntersections = (location) => {
const mockIntersections = [
{ name: ‘Main St & Oak Ave’, direction: ‘left’, lat: location.lat + 0.002, lng: location.lng + 0.001 },
{ name: ‘Main St & Elm St’, direction: ‘straight’, lat: location.lat, lng: location.lng + 0.003 },
{ name: ‘Park Rd & Main St’, direction: ‘right’, lat: location.lat - 0.001, lng: location.lng + 0.002 }
];
setNearbyIntersections(mockIntersections);
};

// ==================== STORY GENERATION ====================
const triggerIntersectionDecision = async (location) => {
if (isChoicesVisible || !currentChapter) return;

```
setIsGenerating(true);
setChoicesVisible(false);

try {
  const intersectionPrompt = `You are an AI storyteller creating interactive adventure stories for runners. 
```

Current Story Context:
Genre: ${selectedGenre}
Current Chapter: ${currentChapter}
Previous Story: ${storyLog.slice(-1)[0] || ‘Beginning of adventure’}

User Location: ${currentLocation?.lat}, ${currentLocation?.lng}
Nearby Intersections: ${nearbyIntersections.map(i => `${i.name} (${i.direction})`).join(’, ’)}

Generate exactly 2-3 story choice options for this intersection. Each choice should:

1. Reference the actual intersection name and direction
1. Lead to different story outcomes
1. Be distinct and meaningful

Format as JSON:
{
“choices”: [
{ “id”: 1, “intersection”: “Name & Street”, “direction”: “left/straight/right”, “text”: “Choice description…” },
{ “id”: 2, “intersection”: “Name & Street”, “direction”: “left/straight/right”, “text”: “Choice description…” }
]
}`;

```
  const choicesResponse = await fetch('https://api.mistral.ai/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      max_tokens: 500,
      messages: [{ role: 'user', content: intersectionPrompt }]
    })
  });

  const choicesData = await choicesResponse.json();
  const choicesText = choicesData.content[0].text;
  const parsedChoices = JSON.parse(choicesText.match(/\{[\s\S]*\}/)[0]);
  
  setChoices(parsedChoices.choices);
  setChoicesVisible(true);
  lastIntersectionRef.current = { location, intersections: nearbyIntersections };
} catch (error) {
  console.error('Error generating choices:', error);
  setIsGenerating(false);
}
```

};

const handleChoice = async (choice) => {
setChoices([]);
setChoicesVisible(false);
setIsGenerating(true);

```
try {
  const chapterPrompt = `You are an adventurous storyteller creating immersive interactive fiction for runners.
```

Genre: ${selectedGenre}
Real Location: Runner just passed ${choice.intersection}, heading ${choice.direction}
User’s Choice: ${choice.text}

Previous Story Summary: ${storyLog.slice(-1)[0] || ‘This is the beginning of the adventure’}

Write a new chapter (minimum 500 words) for this interactive adventure story that:

1. Incorporates the real intersection and direction taken
1. Responds to the player’s choice with vivid, immersive narrative
1. Builds mystery and excitement for a ${selectedGenre} adventure
1. Sets up new challenges or opportunities
1. Feels like it’s happening in the real location the runner is at
1. Ends with a hook toward the next decision point

Make it engaging, descriptive, and genre-appropriate.`;

```
  const response = await fetch('https://api.mistral.ai/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      max_tokens: 2000,
      messages: [{ role: 'user', content: chapterPrompt }]
    })
  });

  const data = await response.json();
  const chapterText = data.content[0].text;

  // Generate TTS Audio
  await generateAndPlayAudio(chapterText);
  
  setCurrentChapter(chapterText);
  setStoryLog(prev => [...prev, chapterText]);
  setIsGenerating(false);
} catch (error) {
  console.error('Error generating chapter:', error);
  setIsGenerating(false);
}
```

};

const generateAndPlayAudio = async (text) => {
setIsAudioPlaying(true);

```
try {
  const ttsResponse = await fetch('https://api.mistral.ai/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MISTRAL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MISTRAL_TTS_MODEL,
      input: text,
      voice: MISTRAL_TTS_VOICE
    })
  });

  if (!ttsResponse.ok) {
    throw new Error(`TTS Error: ${ttsResponse.status}`);
  }

  const audioBlob = await ttsResponse.blob();
  const url = URL.createObjectURL(audioBlob);
  setAudioUrl(url);

  // Play audio
  if (audioRef.current) {
    audioRef.current.src = url;
    audioRef.current.play();
  }
} catch (error) {
  console.error('TTS Error:', error);
  setIsAudioPlaying(false);
}
```

};

const handleAudioEnd = () => {
setIsAudioPlaying(false);
// Choices become visible only after audio finishes
setTimeout(() => setChoicesVisible(true), 500);
};

// ==================== SAVE & SHARE ====================
const saveAdventure = () => {
if (!currentUser) return;

```
const adventure = {
  id: Date.now(),
  genre: selectedGenre,
  story: storyLog,
  route: routeHistory,
  createdAt: new Date().toISOString(),
  title: `${selectedGenre.toUpperCase()} Run - ${new Date().toLocaleDateString()}`
};

const updatedUser = {
  ...currentUser,
  adventures: [...(currentUser.adventures || []), adventure]
};

const users = JSON.parse(localStorage.getItem('runUsers') || '[]');
const userIndex = users.findIndex(u => u.id === currentUser.id);
users[userIndex] = updatedUser;
localStorage.setItem('runUsers', JSON.stringify(users));
setCurrentUser(updatedUser);

alert('Adventure saved!');
```

};

const shareAdventure = () => {
const shareText = `Check out my ${selectedGenre} run adventure! ${routeHistory.length} intersections, ${storyLog.length} chapters`;
if (navigator.share) {
navigator.share({ title: ‘Run Adventure’, text: shareText });
} else {
alert(shareText);
}
};

const startNewAdventure = (genre) => {
setSelectedGenre(genre);
setGameState(‘running’);
setCurrentChapter(`You stand at the start of your ${genre} adventure. The world awaits...`);
setStoryLog([]);
setRouteHistory([]);
startTracking();
};

// ==================== RENDER ====================
if (showAuthModal && !currentUser) {
return (
<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
<div className="w-full max-w-md">
<div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-2xl">
<h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2 font-serif">
RunStory
</h1>
<p className="text-gray-300 mb-8 text-sm">Turn your runs into epic adventures</p>

```
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-lg transition transform hover:scale-105"
          >
            {authMode === 'login' ? 'Login' : 'Sign Up'}
          </button>
        </form>

        <button
          onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
          className="w-full mt-4 text-purple-300 hover:text-purple-100 text-sm transition"
        >
          {authMode === 'login' ? 'Need an account? Sign up' : 'Have an account? Login'}
        </button>
      </div>
    </div>
  </div>
);
```

}

if (!gameState) {
return (
<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
<div className="max-w-6xl mx-auto">
{/* Header */}
<div className="flex justify-between items-center mb-12">
<div>
<h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 font-serif">
RunStory
</h1>
<p className="text-gray-300 mt-2">Epic adventures, real routes</p>
</div>
<button
onClick={handleLogout}
className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition"
>
Logout
</button>
</div>

```
      {/* Genre Selection */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-6">Choose Your Genre</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {GENRES.map(genre => (
            <button
              key={genre}
              onClick={() => startNewAdventure(genre)}
              className="group relative overflow-hidden rounded-xl p-6 text-center transition transform hover:scale-105"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${
                genre === 'fantasy' ? 'from-purple-600 to-pink-600' :
                genre === 'sci-fi' ? 'from-cyan-600 to-blue-600' :
                genre === 'mystery' ? 'from-orange-600 to-red-600' :
                genre === 'horror' ? 'from-red-900 to-black' :
                'from-green-600 to-emerald-600'
              }`}/>
              <div className="relative z-10">
                <h3 className="text-xl font-bold text-white capitalize">{genre}</h3>
                <p className="text-white/70 text-sm mt-2">
                  {genre === 'fantasy' && 'Dragons, magic, quests'}
                  {genre === 'sci-fi' && 'Aliens, tech, space'}
                  {genre === 'mystery' && 'Clues, secrets, twists'}
                  {genre === 'horror' && 'Thrills, chills, frights'}
                  {genre === 'adventure' && 'Exploration, action, thrills'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Saved Adventures */}
      {currentUser?.adventures?.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">Your Adventures</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {currentUser.adventures.map(adventure => (
              <div
                key={adventure.id}
                className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 hover:border-purple-400 transition"
              >
                <h3 className="text-xl font-bold text-white mb-2">{adventure.title}</h3>
                <p className="text-gray-300 text-sm mb-4">
                  {adventure.route.length} intersections • {adventure.story.length} chapters
                </p>
                <button
                  onClick={() => shareAdventure()}
                  className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-2"
                >
                  <Share2 size={16} /> Share
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);
```

}

// Running View
return (
<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
<div className="max-w-4xl mx-auto">
{/* Header */}
<div className="flex justify-between items-center mb-6">
<div>
<h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
{selectedGenre?.toUpperCase()} Adventure
</h2>
{currentLocation && (
<p className="text-gray-300 text-sm flex items-center gap-2 mt-1">
<MapPin size={16} /> {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
</p>
)}
</div>
<div className="flex gap-3">
{isRunning ? (
<button
onClick={stopTracking}
className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition"
>
<Square size={16} /> Stop
</button>
) : (
<button
onClick={startTracking}
className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition"
>
<Play size={16} /> Start
</button>
)}
<button
onClick={saveAdventure}
className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition"
>
<Save size={16} /> Save
</button>
</div>
</div>

```
    {/* Story Display */}
    <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-8 mb-6">
      {currentChapter ? (
        <>
          <div className="text-white/90 leading-relaxed mb-6 text-lg font-serif">
            {currentChapter}
          </div>
          
          {audioUrl && (
            <div className="mb-6 p-4 bg-black/30 rounded-lg">
              <audio
                ref={audioRef}
                onEnded={handleAudioEnd}
                className="w-full"
                controls
              />
              {isAudioPlaying && (
                <div className="flex items-center gap-2 text-purple-400 text-sm mt-2">
                  <Volume2 size={16} className="animate-pulse" />
                  Audio playing... choices will appear when finished
                </div>
              )}
            </div>
          )}

          {isGenerating && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-400 mx-auto mb-2" />
              <p className="text-gray-300">Generating next chapter...</p>
            </div>
          )}

          {choicesVisible && !isAudioPlaying && !isGenerating && choices.length > 0 && (
            <div className="space-y-3">
              <p className="text-gray-300 font-semibold mb-4">What do you do at {choices[0].intersection}?</p>
              {choices.map(choice => (
                <button
                  key={choice.id}
                  onClick={() => handleChoice(choice)}
                  className="w-full p-4 bg-gradient-to-r from-purple-600/50 to-pink-600/50 hover:from-purple-600 hover:to-pink-600 border border-white/20 rounded-lg text-white transition transform hover:scale-105 text-left"
                >
                  <p className="font-semibold text-sm text-gray-200 mb-2">
                    Turn {choice.direction.toUpperCase()} at {choice.intersection}
                  </p>
                  <p className="text-white">{choice.text}</p>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-300 mb-4">Start running to begin your adventure...</p>
          {isRunning && (
            <div className="flex items-center justify-center gap-2 text-purple-400">
              <div className="animate-pulse">•</div> Tracking location
            </div>
          )}
        </div>
      )}
    </div>

    {/* Stats */}
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-white/10 border border-white/20 rounded-lg p-4 text-center">
        <p className="text-gray-400 text-sm">Chapters</p>
        <p className="text-2xl font-bold text-purple-400">{storyLog.length}</p>
      </div>
      <div className="bg-white/10 border border-white/20 rounded-lg p-4 text-center">
        <p className="text-gray-400 text-sm">Intersections</p>
        <p className="text-2xl font-bold text-pink-400">{routeHistory.length}</p>
      </div>
      <div className="bg-white/10 border border-white/20 rounded-lg p-4 text-center">
        <p className="text-gray-400 text-sm">Status</p>
        <p className="text-2xl font-bold text-green-400">{isRunning ? 'Running' : 'Idle'}</p>
      </div>
    </div>
  </div>
</div>
```

);
};

export default RunAdventureApp;
