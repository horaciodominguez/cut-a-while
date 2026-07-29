
import { useEffect, useState } from 'react';
import './App.css'
import { formatSecondsToTime } from './core/utils/time'
import { useTimer } from './modules/timer/hooks/useTimer'
import { useSound } from './core/hooks/useSound';


function App() {

  const { state, dispatch } = useTimer()
  const [showFallback, setShowFallback] = useState(false)
  
  const { init: initBeep, play: playBeep } = useSound("/beep.mp3");

  useEffect(() => {
    if (state.status === "running" && state.timeLeft === 0) {
      playBeep();
    }
  }, [state.status, state.timeLeft, playBeep]);
 

  useEffect(() => {
    if ("Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then((perm) => {
          if (perm !== "granted") {
            setShowFallback(true)
          }
        });
      } else if (Notification.permission !== "granted") {
        setShowFallback(true)
        
      }
    }

  }, []);

  const handleStart = () => {
    dispatch({ type: "START" })
    initBeep();
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center h-screen">

        <h1 className="text-4xl font-bold">Timer App</h1>

        {showFallback && (
          <div className="bg-yellow-200 p-2 rounded mt-4 text-center">
            ⚠️ No hay permiso para notificaciones.  
            Te mostraremos recordatorios dentro de la app.
          </div>
        )}

        <div className="rounded-full border py-8 px-4 m-4 bg-gray-800">
          {state.status}
          <br />
          {state.cycleType}
          <br />
          {state.status === "running" && <span>Time Left: {formatSecondsToTime(state.timeLeft)}</span>}
        </div>
        
        {
          state.status === "idle" && (
            <button onClick={handleStart}>Start</button>
          )
        }
        {
          state.status === "running" && (
            <button onClick={() => dispatch({ type: "PAUSE" })}>Pause</button>
          )
        }
        {
          state.status === "paused" && (
            <button onClick={() => dispatch({ type: "RESUME" })}>Resume</button>
          )
        }

        <button onClick={() => dispatch({ type: "STOP" })}>Stop</button>
        <button onClick={() => dispatch({ type: "RESET" })}>Reset</button>
      </div>

    </>
  )
}

export default App
