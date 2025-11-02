import React, { useState, useEffect, useRef } from 'react';
import './VoiceControl.css';

interface VoiceCommand {
  command: string;
  timestamp: Date;
  response: string;
  success: boolean;
}

export const VoiceControl: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [commandHistory, setCommandHistory] = useState<VoiceCommand[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcriptText = event.results[current][0].transcript;
        setTranscript(transcriptText);

        if (event.results[current].isFinal) {
          processCommand(transcriptText);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      setVoiceEnabled(true);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
      setIsListening(true);
      setTranscript('');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const processCommand = async (command: string) => {
    try {
      const response = await fetch('/api/voice/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });

      const result = await response.json();

      const voiceCommand: VoiceCommand = {
        command,
        timestamp: new Date(),
        response: result.message || 'Command executed',
        success: response.ok
      };

      setCommandHistory(prev => [voiceCommand, ...prev].slice(0, 10));
      speak(voiceCommand.response);
    } catch (error) {
      console.error('Failed to process command:', error);
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!voiceEnabled) {
    return (
      <div className="voice-control-disabled">
        <p>Voice control is not supported in your browser</p>
      </div>
    );
  }

  return (
    <div className="voice-control">
      <div className="voice-header">
        <h2>Voice Control</h2>
        <button
          className={`voice-button ${isListening ? 'listening' : ''}`}
          onClick={isListening ? stopListening : startListening}
        >
          {isListening ? '🎤 Listening...' : '🎤 Start Voice Control'}
        </button>
      </div>

      {transcript && (
        <div className="transcript">
          <p><strong>You said:</strong> {transcript}</p>
        </div>
      )}

      <div className="command-history">
        <h3>Recent Commands</h3>
        {commandHistory.length === 0 ? (
          <p className="no-commands">No commands yet</p>
        ) : (
          <ul>
            {commandHistory.map((cmd, index) => (
              <li key={index} className={cmd.success ? 'success' : 'error'}>
                <div className="command-text">{cmd.command}</div>
                <div className="command-response">{cmd.response}</div>
                <div className="command-time">
                  {cmd.timestamp.toLocaleTimeString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="voice-tips">
        <h4>Try saying:</h4>
        <ul>
          <li>"Turn on the living room lights"</li>
          <li>"Set temperature to 72 degrees"</li>
          <li>"Lock the front door"</li>
          <li>"Show me the security cameras"</li>
        </ul>
      </div>
    </div>
  );
};
