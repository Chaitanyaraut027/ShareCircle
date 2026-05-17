import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Modal
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../utils/constants';

const ShareCircleBot = ({ user }) => {
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { id: '1', text: "Hi! I'm ShareCircle Bot 🤖. How can I help you today?", isBot: true }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef(null);

  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    const userMsg = message.trim();
    setMessage('');
    
    const newMessages = [...messages, { id: Date.now().toString(), text: userMsg, isBot: false }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Get token if you use auth
      const res = await axios.post(`${API_URL}/chatbot/chat`, {
        message: userMsg
      });

      if (res.data.success) {
        setMessages(prev => [...prev, { id: Date.now().toString(), text: res.data.response, isBot: true }]);
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), text: "Sorry, I couldn't process that. Please try again.", isBot: true }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now().toString(), text: "Oops! My servers are a bit busy. Please try again later.", isBot: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (expanded) {
    return (
      <Modal visible={expanded} transparent animationType="slide" onRequestClose={toggleExpand}>
        <View style={styles.expandedContainer}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            style={styles.chatWindow}
          >
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.botAvatarSmall}>
                  <MaterialCommunityIcons name="robot-outline" size={20} color="#FFF" />
                </View>
                <Text style={styles.headerTitle}>ShareCircle Bot</Text>
              </View>
              <TouchableOpacity onPress={toggleExpand} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.map((msg) => (
                <View key={msg.id} style={[styles.messageBubbleWrapper, msg.isBot ? styles.botBubbleWrapper : styles.userBubbleWrapper]}>
                  {msg.isBot && (
                    <View style={styles.botIconMini}>
                      <MaterialCommunityIcons name="robot-outline" size={16} color="#2F7B5E" />
                    </View>
                  )}
                  <View style={[styles.messageBubble, msg.isBot ? styles.botBubble : styles.userBubble]}>
                    <Text style={[styles.messageText, msg.isBot ? styles.botText : styles.userText]}>{msg.text}</Text>
                  </View>
                </View>
              ))}
              {isLoading && (
                <View style={[styles.messageBubbleWrapper, styles.botBubbleWrapper]}>
                  <View style={styles.botIconMini}>
                    <MaterialCommunityIcons name="robot-outline" size={16} color="#2F7B5E" />
                  </View>
                  <View style={[styles.messageBubble, styles.botBubble, { padding: 10 }]}>
                    <ActivityIndicator size="small" color="#2F7B5E" />
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Ask me anything..."
                placeholderTextColor="#94A3B8"
                value={message}
                onChangeText={setMessage}
                onSubmitEditing={sendMessage}
              />
              <TouchableOpacity 
                style={[styles.sendBtn, !message.trim() && { opacity: 0.5 }]} 
                onPress={sendMessage}
                disabled={!message.trim() || isLoading}
              >
                <Ionicons name="send" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  }

  return (
    <View style={styles.floatingButton}>
      <TouchableOpacity 
        style={styles.botButtonContent} 
        activeOpacity={0.8}
        onPress={toggleExpand}
      >
        <MaterialCommunityIcons name="robot-outline" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  // Floating Button
  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    zIndex: 999,
  },
  botButtonContent: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2F7B5E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2F7B5E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  
  // Expanded Chat Window
  expandedContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  chatWindow: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  botAvatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2F7B5E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
  },
  closeBtn: {
    padding: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
  },
  
  // Messages
  messagesContainer: {
    flex: 1,
  },
  messageBubbleWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  botBubbleWrapper: {
    alignSelf: 'flex-start',
  },
  userBubbleWrapper: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  botIconMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D1EAE0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  botBubble: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userBubble: {
    backgroundColor: '#2F7B5E',
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  botText: {
    color: '#334155',
  },
  userText: {
    color: '#FFF',
  },
  
  // Input
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 20,
    fontSize: 15,
    color: '#1E293B',
    marginRight: 10,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2F7B5E',
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default ShareCircleBot;
