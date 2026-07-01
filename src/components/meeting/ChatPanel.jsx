import { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import SendIcon from '@mui/icons-material/Send';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import { useAuth } from '../../contexts/AuthContext';

export default function ChatPanel({ messages, onSendMessage }) {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input.trim(), user.id, user.displayName);
    setInput('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle2">Chat</Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 1.5 }}>
        {messages.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              opacity: 0.4,
            }}
          >
            <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="caption">No messages yet</Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {messages.map((msg) => {
            const isOwn = msg.senderId === user.id;
            return (
              <Box
                key={msg.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isOwn ? 'flex-end' : 'flex-start',
                }}
              >
                <Box
                  sx={{
                    maxWidth: '85%',
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: isOwn ? 'primary.main' : 'grey.900',
                    color: isOwn ? 'white' : 'grey.200',
                  }}
                >
                  {msg.type === 'system' ? (
                    <Typography
                      variant="caption"
                      sx={{ fontStyle: 'italic', color: 'grey.500', textAlign: 'center', display: 'block' }}
                    >
                      {msg.content}
                    </Typography>
                  ) : (
                    <>
                      {!isOwn && (
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'grey.400', display: 'block', mb: 0.25 }}>
                          {msg.senderName}
                        </Typography>
                      )}
                      <Typography variant="body2">{msg.content}</Typography>
                    </>
                  )}
                </Box>
                <Typography variant="caption" sx={{ color: 'grey.700', px: 0.5, mt: 0.25 }}>
                  {msg.timestamp?.toDate
                    ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </Typography>
              </Box>
            );
          })}
          <div ref={bottomRef} />
        </Box>
      </Box>

      <Box
        component="form"
        onSubmit={handleSend}
        sx={{
          display: 'flex',
          gap: 1,
          p: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <TextField
          size="small"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          sx={{ flex: 1 }}
          slotProps={{
            input: {
              sx: { fontSize: 13 },
            },
          }}
        />
        <IconButton
          type="submit"
          disabled={!input.trim()}
          color="primary"
          sx={{
            width: 36,
            height: 36,
            bgcolor: 'primary.main',
            color: 'white',
            borderRadius: 1.5,
            '&:hover': { bgcolor: 'primary.dark' },
            '&.Mui-disabled': { bgcolor: 'grey.800', color: 'grey.600' },
          }}
        >
          <SendIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    </Box>
  );
}
