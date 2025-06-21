// Configuration
const GEMINI_API_KEY = "AIzaSyDNMq_uIatd5iE5uHcmfya1rHaAuLanpZA"; // Replace with your actual API key
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const MAX_HISTORY_ITEMS = 10;
const MAX_TEXT_LENGTH = 100000; // 100k characters limit
const PDFJS = pdfjsLib;

// Initialize PDF.js worker
PDFJS.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js";

// State Management
let analysisHistory = JSON.parse(
  localStorage.getItem("analysisHistory") || "[]"
);
let isRecording = false;
let recognition = null;
let currentAnalysis = null;
let originalText = "";

// DOM Elements
const elements = {
  inputText: document.getElementById("inputText"),
  charCount: document.getElementById("charCount"),
  wordCount: document.getElementById("wordCount"),
  sentenceCount: document.getElementById("sentenceCount"),
  readingTime: document.getElementById("readingTime"),
  clearBtn: document.getElementById("clearBtn"),
  pasteBtn: document.getElementById("pasteBtn"),
  enhanceBtn: document.getElementById("enhanceBtn"),
  uploadBtn: document.getElementById("uploadBtn"),
  voiceBtn: document.getElementById("voiceBtn"),
  urlBtn: document.getElementById("urlBtn"),
  voiceText: document.getElementById("voiceText"),
  fileInput: document.getElementById("fileInput"),
  summarizeBtn: document.getElementById("summarizeBtn"),
  compareBtn: document.getElementById("compareBtn"),
  rewriteBtn: document.getElementById("rewriteBtn"),
  btnText: document.getElementById("btnText"),
  loadingSpinner: document.getElementById("loadingSpinner"),
  progressContainer: document.getElementById("progressContainer"),
  progressBar: document.getElementById("progressBar"),
  outputSection: document.getElementById("outputSection"),
  summaryOutput: document.getElementById("summaryOutput"),
  summaryStats: document.getElementById("summaryStats"),
  processingTime: document.getElementById("processingTime"),
  copyBtn: document.getElementById("copyBtn"),
  shareBtn: document.getElementById("shareBtn"),
  errorSection: document.getElementById("errorSection"),
  errorMessage: document.getElementById("errorMessage"),
  advancedToggle: document.getElementById("advancedToggle"),
  advancedOptions: document.getElementById("advancedOptions"),
  keywordsCloud: document.getElementById("keywordsCloud"),
  sentimentAnalysis: document.getElementById("sentimentAnalysis"),
  entitiesAnalysis: document.getElementById("entitiesAnalysis"),
  textMetrics: document.getElementById("textMetrics"),
  readabilityScore: document.getElementById("readabilityScore"),
  questionsGenerated: document.getElementById("questionsGenerated"),
  translationResult: document.getElementById("translationResult"),
  tocContainer: document.getElementById("tocContainer"),
  historyList: document.getElementById("historyList"),
  clearHistory: document.getElementById("clearHistory"),
  exportHistory: document.getElementById("exportHistory"),
  originalText: document.getElementById("originalText"),
  copyOriginalBtn: document.getElementById("copyOriginalBtn"),
  highlightBtn: document.getElementById("highlightBtn"),
  urlModal: document.getElementById("urlModal"),
  urlInput: document.getElementById("urlInput"),
  fetchUrlBtn: document.getElementById("fetchUrlBtn"),
  closeUrlModal: document.getElementById("closeUrlModal"),
  cancelUrlBtn: document.getElementById("cancelUrlBtn"),
  includeTranslation: document.getElementById("includeTranslation"),
  translationOptions: document.getElementById("translationOptions"),
  targetLanguage: document.getElementById("targetLanguage"),
  includeEntities: document.getElementById("includeEntities"),
  includeTOC: document.getElementById("includeTOC"),
};

// Event Listeners
elements.inputText.addEventListener("input", updateTextStats);
elements.clearBtn.addEventListener("click", clearText);
elements.pasteBtn.addEventListener("click", pasteText);
elements.enhanceBtn.addEventListener("click", enhanceText);
elements.uploadBtn.addEventListener("click", () => elements.fileInput.click());
elements.voiceBtn.addEventListener("click", toggleVoiceInput);
elements.fileInput.addEventListener("change", handleFileUpload);
elements.summarizeBtn.addEventListener("click", analyzeText);
elements.compareBtn.addEventListener("click", compareSummaries);
elements.rewriteBtn.addEventListener("click", rewriteText);
elements.copyBtn.addEventListener("click", copyToClipboard);
elements.shareBtn.addEventListener("click", shareResults);
elements.advancedToggle.addEventListener("click", toggleAdvancedOptions);
elements.clearHistory.addEventListener("click", clearAnalysisHistory);
elements.exportHistory.addEventListener("click", exportHistory);
elements.copyOriginalBtn.addEventListener("click", copyOriginalToClipboard);
elements.highlightBtn.addEventListener("click", highlightKeyInfo);
elements.fetchUrlBtn.addEventListener("click", fetchUrlContent);
elements.closeUrlModal.addEventListener("click", hideUrlModal);
elements.cancelUrlBtn.addEventListener("click", hideUrlModal);
elements.includeTranslation.addEventListener(
  "change",
  toggleTranslationOptions
);
elements.includeEntities.addEventListener("change", updateTextStats);
elements.includeTOC.addEventListener("change", updateTextStats);

// Tab navigation
document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", (e) => {
    const tabName = e.target.dataset.tab;
    switchTab(tabName);
  });
});

// Export buttons
document
  .getElementById("exportPdf")
  .addEventListener("click", () => exportResults("pdf"));
document
  .getElementById("exportWord")
  .addEventListener("click", () => exportResults("word"));
document
  .getElementById("exportJson")
  .addEventListener("click", () => exportResults("json"));
document
  .getElementById("exportMarkdown")
  .addEventListener("click", () => exportResults("markdown"));
document
  .getElementById("exportText")
  .addEventListener("click", () => exportResults("text"));
document
  .getElementById("exportHtml")
  .addEventListener("click", () => exportResults("html"));

// Initialize app
initializeApp();

function initializeApp() {
  updateTextStats();
  loadAnalysisHistory();
  initializeVoiceRecognition();
  checkClipboardPermission();
}

function checkClipboardPermission() {
  // Check if we can read from clipboard
  navigator.permissions
    .query({ name: "clipboard-read" })
    .then((result) => {
      if (result.state === "denied") {
        elements.pasteBtn.disabled = true;
        elements.pasteBtn.title = "Clipboard access denied by user";
      }
    })
    .catch((err) => {
      console.log("Clipboard permission check failed:", err);
    });
}

function initializeVoiceRecognition() {
  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        elements.inputText.value += finalTranscript;
        updateTextStats();
      }
    };

    recognition.onerror = (event) => {
      showError("Voice recognition error: " + event.error);
      stopVoiceInput();
    };

    recognition.onend = () => {
      stopVoiceInput();
    };
  } else {
    elements.voiceBtn.style.display = "none";
  }
}

function updateTextStats() {
  const text = elements.inputText.value;
  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const sentences = text
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 0).length;
  const readingTime = Math.ceil(wordCount / 200); // Average 200 words per minute

  elements.charCount.textContent = `${charCount.toLocaleString()} characters`;
  elements.wordCount.textContent = `${wordCount.toLocaleString()} words`;
  elements.sentenceCount.textContent = `${sentences} sentences`;
  elements.readingTime.textContent = `~${readingTime} min read`;

  // Enable/disable buttons based on text length
  const hasMinimumText = charCount >= 50;
  elements.summarizeBtn.disabled = !hasMinimumText;
  elements.compareBtn.disabled =
    !hasMinimumText || analysisHistory.length === 0;
  elements.rewriteBtn.disabled = !hasMinimumText;
  elements.enhanceBtn.disabled = !hasMinimumText;
}

function clearText() {
  elements.inputText.value = "";
  updateTextStats();
  hideOutput();
  hideError();
}

async function pasteText() {
  try {
    const text = await navigator.clipboard.readText();
    if (text.length > MAX_TEXT_LENGTH) {
      showError(`Text is too long (max ${MAX_TEXT_LENGTH} characters)`);
      return;
    }
    elements.inputText.value = text;
    updateTextStats();
  } catch (err) {
    // Fallback for browsers that don't support clipboard API
    elements.inputText.focus();
    document.execCommand("paste");
    updateTextStats();
  }
}

async function enhanceText() {
  const text = elements.inputText.value.trim();
  if (text.length < 50) {
    showError("Please enter at least 50 characters to enhance");
    return;
  }

  setLoading(true);
  showProgress(10);
  hideError();
  hideOutput();

  try {
    const enhancedText = await callGeminiAPI(
      text,
      "enhance",
      "medium",
      "general"
    );

    elements.inputText.value = enhancedText;
    updateTextStats();
    showSuccess("Text enhanced successfully!");
  } catch (error) {
    showError(error.message || "Failed to enhance text");
  } finally {
    setLoading(false);
    hideProgress();
  }
}

function toggleVoiceInput() {
  if (!recognition) {
    showError("Voice recognition is not supported in your browser");
    return;
  }

  if (isRecording) {
    stopVoiceInput();
  } else {
    startVoiceInput();
  }
}

function startVoiceInput() {
  isRecording = true;
  elements.voiceText.textContent = "Stop";
  elements.voiceBtn.classList.add("bg-red-500/20");
  recognition.start();
}

function stopVoiceInput() {
  isRecording = false;
  elements.voiceText.textContent = "Voice";
  elements.voiceBtn.classList.remove("bg-red-500/20");
  if (recognition) {
    recognition.stop();
  }
}

function showUrlModal() {
  elements.urlModal.classList.remove("hidden");
  elements.urlInput.focus();
}

function hideUrlModal() {
  elements.urlModal.classList.add("hidden");
  elements.urlInput.value = "";
}

async function fetchUrlContent() {
  const url = elements.urlInput.value.trim();
  if (!url) {
    showError("Please enter a valid URL");
    return;
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    showError("URL must start with http:// or https://");
    return;
  }

  setLoading(true);
  showProgress(10);
  hideError();
  hideOutput();
  hideUrlModal();

  try {
    // Use a proxy to avoid CORS issues (in a real app, you'd use your own backend)
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(
      url
    )}`;
    const response = await fetch(proxyUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const data = await response.json();
    if (!data.contents) {
      throw new Error("No content found at this URL");
    }

    // Extract text from HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(data.contents, "text/html");
    const text = extractTextFromHtml(doc.body);

    if (text.length > MAX_TEXT_LENGTH) {
      showError(
        `Content is too long (max ${MAX_TEXT_LENGTH} characters). Please try a shorter page.`
      );
      return;
    }

    elements.inputText.value = text;
    updateTextStats();
    showSuccess("Content fetched successfully!");
  } catch (error) {
    showError(error.message || "Failed to fetch URL content");
  } finally {
    setLoading(false);
    hideProgress();
  }
}

function extractTextFromHtml(element) {
  let text = "";

  // Skip script and style elements
  if (element.tagName === "SCRIPT" || element.tagName === "STYLE") {
    return text;
  }

  // Add text content for text nodes
  if (element.nodeType === Node.TEXT_NODE) {
    return element.textContent.trim() + " ";
  }

  // Recursively process child nodes
  for (const child of element.childNodes) {
    text += extractTextFromHtml(child);
  }

  // Add line breaks for block elements
  const blockElements = [
    "DIV",
    "P",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "LI",
    "BR",
  ];
  if (blockElements.includes(element.tagName)) {
    text += "\n\n";
  }

  return text;
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    showError("File size too large. Please select a file under 10MB.");
    return;
  }

  try {
    showProgress(20);
    let text = "";

    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      text = await file.text();
    } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      text = await extractTextFromPdf(file);
    } else if (
      file.type === "application/msword" ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.endsWith(".doc") ||
      file.name.endsWith(".docx")
    ) {
      showError(
        "Word document processing requires a backend service. Please copy and paste the text instead."
      );
      return;
    } else if (file.type === "application/rtf" || file.name.endsWith(".rtf")) {
      showError(
        "RTF document processing requires a backend service. Please copy and paste the text instead."
      );
      return;
    } else {
      showError("Unsupported file type. Please upload a .txt or .pdf file.");
      return;
    }

    if (text.length > MAX_TEXT_LENGTH) {
      showError(
        `File content is too long (max ${MAX_TEXT_LENGTH} characters). Please try a smaller file.`
      );
      return;
    }

    showProgress(100);
    elements.inputText.value = text;
    updateTextStats();
    hideProgress();
    showSuccess("File content loaded successfully!");
  } catch (error) {
    showError("Failed to read file: " + error.message);
    hideProgress();
  }
}

async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFJS.getDocument(arrayBuffer).promise;
  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item) => item.str);
    text += strings.join(" ") + "\n\n";
  }

  return text;
}

async function analyzeText() {
  const text = elements.inputText.value.trim();

  if (text.length < 50) {
    showError("Please enter at least 50 characters for analysis");
    return;
  }

  if (GEMINI_API_KEY === "AIzaSyBOKY4RzIVCHrbchLMk-AXcDznOgLomNLg") {
    showError("Please add your Gemini API key to use this feature");
    return;
  }

  const startTime = Date.now();
  setLoading(true);
  showProgress(10);
  hideError();
  hideOutput();

  try {
    // Store original text
    originalText = text;

    // Get selected options
    const summaryType = document.querySelector(
      'input[name="summaryType"]:checked'
    ).value;
    const summaryLength = document.getElementById("summaryLength").value;
    const focusArea = document.getElementById("focusArea").value;
    const includeKeywords = document.getElementById("includeKeywords").checked;
    const includeSentiment =
      document.getElementById("includeSentiment").checked;
    const includeQuestions =
      document.getElementById("includeQuestions").checked;
    const includeEntities = document.getElementById("includeEntities").checked;
    const includeTOC = document.getElementById("includeTOC").checked;
    const includeTranslation =
      document.getElementById("includeTranslation").checked;
    const targetLanguage = document.getElementById("targetLanguage").value;

    showProgress(30);

    // Generate main summary
    const summary = await callGeminiAPI(
      text,
      summaryType,
      summaryLength,
      focusArea
    );
    showProgress(60);

    // Generate additional analysis if requested
    const analysis = {
      summary,
      keywords: includeKeywords ? await extractKeywords(text) : null,
      sentiment: includeSentiment ? await analyzeSentiment(text) : null,
      questions: includeQuestions ? await generateQuestions(text) : null,
      entities: includeEntities ? await extractEntities(text) : null,
      toc: includeTOC ? await generateTableOfContents(text) : null,
      translation: includeTranslation
        ? await translateText(text, targetLanguage)
        : null,
      metrics: calculateTextMetrics(text),
      readability: calculateReadabilityScore(text),
    };

    showProgress(100);

    const endTime = Date.now();
    const processingTimeMs = endTime - startTime;

    currentAnalysis = {
      originalText: text,
      analysis,
      options: {
        summaryType,
        summaryLength,
        focusArea,
        includeKeywords,
        includeSentiment,
        includeQuestions,
        includeEntities,
        includeTOC,
        includeTranslation,
        targetLanguage,
      },
      timestamp: new Date().toISOString(),
      processingTime: processingTimeMs,
    };

    showAnalysis(currentAnalysis);
    saveToHistory(currentAnalysis);
    hideProgress();
  } catch (error) {
    showError(error.message || "Failed to generate analysis");
    hideProgress();
  } finally {
    setLoading(false);
  }
}

async function rewriteText() {
  const text = elements.inputText.value.trim();

  if (text.length < 50) {
    showError("Please enter at least 50 characters to rewrite");
    return;
  }

  const startTime = Date.now();
  setLoading(true);
  showProgress(10);
  hideError();
  hideOutput();

  try {
    const rewrittenText = await callGeminiAPI(
      text,
      "rewrite",
      "medium",
      "general"
    );

    elements.inputText.value = rewrittenText;
    updateTextStats();
    showSuccess("Text rewritten successfully!");
  } catch (error) {
    showError(error.message || "Failed to rewrite text");
  } finally {
    setLoading(false);
    hideProgress();
  }
}

async function callGeminiAPI(text, summaryType, summaryLength, focusArea) {
  const lengthInstructions = {
    short: "approximately 100 words",
    medium: "approximately 200 words",
    long: "approximately 300 words",
    auto: "an appropriate length based on the content",
  };

  const focusInstructions = {
    general: "",
    technical: "Focus on technical details and specifications.",
    business: "Emphasize business implications and strategic insights.",
    academic: "Provide scholarly analysis with critical evaluation.",
    legal: "Focus on legal implications and terminology.",
    medical: "Use medical terminology and focus on health implications.",
    creative: "Analyze literary elements and creative aspects.",
  };

  const prompts = {
    brief: `Please provide a concise summary of the following text in ${lengthInstructions[summaryLength]}. ${focusInstructions[focusArea]}\n\n${text}`,
    detailed: `Please provide a comprehensive summary of the following text in ${lengthInstructions[summaryLength]}, covering all main points and supporting details. ${focusInstructions[focusArea]}\n\n${text}`,
    keypoints: `Please extract the key points from the following text and present them as bullet points (${lengthInstructions[summaryLength]}). ${focusInstructions[focusArea]}\n\n${text}`,
    analytical: `Please provide an analytical summary of the following text in ${lengthInstructions[summaryLength]}, including themes, arguments, and implications. ${focusInstructions[focusArea]}\n\n${text}`,
    enhance: `Please improve the following text while preserving its original meaning. Correct any grammatical errors, improve clarity and flow, and enhance readability. Return only the improved text without additional commentary:\n\n${text}`,
    rewrite: `Please rewrite the following text to improve its clarity and impact while preserving its original meaning. Use a professional tone and ensure the rewritten version is more concise and engaging. Return only the rewritten text without additional commentary:\n\n${text}`,
    entities: `Extract all named entities (people, organizations, locations, dates) from the following text. Format the response as a JSON object with keys "people", "organizations", "locations", and "dates", each containing an array of the extracted entities:\n\n${text}`,
    toc: `Generate a structured table of contents for the following text. Return it as a nested HTML list with links to section headings. Include only major sections and subsections:\n\n${text}`,
    translate: (text, targetLang) =>
      `Translate the following text to ${getLanguageName(
        targetLang
      )}. Preserve the original formatting and meaning as closely as possible:\n\n${text}`,
  };

  let prompt;
  if (summaryType === "translate") {
    prompt = prompts.translate(text, focusArea); // Using focusArea as target language in this case
  } else {
    prompt = prompts[summaryType] || prompts.brief;
  }

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      topK: 32,
      topP: 1,
      maxOutputTokens: 2048,
    },
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error?.message || `API Error: ${response.status}`
    );
  }

  const data = await response.json();

  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error("Invalid response from Gemini API");
  }

  return data.candidates[0].content.parts[0].text;
}

function getLanguageName(code) {
  const languages = {
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    zh: "Chinese",
    ja: "Japanese",
    ar: "Arabic",
    hi: "Hindi",
  };
  return languages[code] || "the target language";
}

async function extractKeywords(text) {
  const prompt = `Extract the 15 most important keywords and phrases from the following text. Return them as a comma-separated list ordered by importance:\n\n${text}`;

  try {
    const response = await callGeminiAPI(prompt, "brief", "short", "general");
    return response
      .split(",")
      .map((keyword) => keyword.trim())
      .filter((k) => k.length > 0);
  } catch (error) {
    return generateSimpleKeywords(text);
  }
}

function generateSimpleKeywords(text) {
  // Remove punctuation and convert to lowercase
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 3);

  // Count word frequencies
  const wordCounts = {};
  words.forEach((word) => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });

  // Sort by frequency and get top 15
  return Object.entries(wordCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([word]) => word);
}

async function analyzeSentiment(text) {
  const prompt = `Analyze the sentiment of the following text. Provide a detailed analysis including:
1. Overall sentiment (positive/negative/neutral) 
2. Sentiment score from -1 (very negative) to 1 (very positive)
3. Key emotional themes detected
4. Any notable shifts in sentiment
Format your response with clear headings for each part:\n\n${text}`;

  try {
    const response = await callGeminiAPI(
      prompt,
      "analytical",
      "medium",
      "general"
    );
    return response;
  } catch (error) {
    return "Sentiment analysis unavailable";
  }
}

async function extractEntities(text) {
  try {
    const response = await callGeminiAPI(text, "entities", "medium", "general");

    // Try to parse as JSON
    try {
      return JSON.parse(response);
    } catch (e) {
      // If not JSON, return as is
      return response;
    }
  } catch (error) {
    return {
      people: [],
      organizations: [],
      locations: [],
      dates: [],
    };
  }
}

async function generateQuestions(text) {
  const prompt = `Generate 5-10 thoughtful questions that could be answered based on the following text. Include both factual and conceptual questions. Format each question on a new line with a bullet point:\n\n${text}`;

  try {
    return await callGeminiAPI(prompt, "keypoints", "medium", "general");
  } catch (error) {
    return "Question generation unavailable";
  }
}

async function generateTableOfContents(text) {
  try {
    return await callGeminiAPI(text, "toc", "medium", "general");
  } catch (error) {
    return "Table of contents generation unavailable";
  }
}

async function translateText(text, targetLanguage) {
  try {
    const translated = await callGeminiAPI(
      text,
      "translate",
      "auto",
      targetLanguage
    );
    return translated;
  } catch (error) {
    return "Translation unavailable";
  }
}

function calculateTextMetrics(text) {
  const words = text.trim() ? text.trim().split(/\s+/) : [];
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  // Calculate average word length
  const avgWordLength =
    words.length > 0
      ? words.reduce((sum, word) => sum + word.length, 0) / words.length
      : 0;

  // Calculate average sentence length
  const avgSentenceLength =
    sentences.length > 0 ? words.length / sentences.length : 0;

  // Calculate lexical diversity (unique words / total words)
  const uniqueWords = new Set(words.map((word) => word.toLowerCase()));
  const lexicalDiversity =
    words.length > 0 ? uniqueWords.size / words.length : 0;

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    avgWordLength: avgWordLength.toFixed(2),
    avgSentenceLength: avgSentenceLength.toFixed(2),
    lexicalDiversity: (lexicalDiversity * 100).toFixed(2) + "%",
  };
}

function calculateReadabilityScore(text) {
  // Implementation of Flesch-Kincaid Reading Ease score
  const words = text.trim() ? text.trim().split(/\s+/) : [];
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  if (words.length === 0 || sentences.length === 0) {
    return {
      score: 0,
      level: "N/A",
    };
  }

  // Count syllables (simplified version)
  let syllableCount = 0;
  words.forEach((word) => {
    syllableCount += Math.max(
      1,
      word.toLowerCase().split(/[aeiouy]+/).length - 1
    );
  });

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllableCount / words.length;

  // Flesch-Kincaid Reading Ease formula
  const score =
    206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;

  // Determine readability level
  let level;
  if (score >= 90) level = "Very Easy (5th grade)";
  else if (score >= 80) level = "Easy (6th grade)";
  else if (score >= 70) level = "Fairly Easy (7th grade)";
  else if (score >= 60) level = "Standard (8th-9th grade)";
  else if (score >= 50) level = "Fairly Difficult (10th-12th grade)";
  else if (score >= 30) level = "Difficult (College)";
  else level = "Very Difficult (College graduate)";

  return {
    score: score.toFixed(2),
    level,
  };
}

function showAnalysis(analysis) {
  // Show summary
  elements.summaryOutput.innerHTML = formatMarkdown(analysis.analysis.summary);

  // Show stats
  const wordCount = analysis.originalText.trim().split(/\s+/).length;
  const summaryWordCount = analysis.analysis.summary.trim().split(/\s+/).length;
  const compressionRatio = (100 - (summaryWordCount / wordCount) * 100).toFixed(
    1
  );

  elements.summaryStats.textContent = `${summaryWordCount} words (${compressionRatio}% reduction)`;
  elements.processingTime.textContent = `Processed in ${
    analysis.processingTime / 1000
  } seconds`;

  // Show keywords if available
  if (analysis.analysis.keywords) {
    elements.keywordsCloud.innerHTML = "";
    analysis.analysis.keywords.forEach((keyword, index) => {
      const size = 12 + (analysis.analysis.keywords.length - index) * 2;
      const tag = document.createElement("span");
      tag.className = "word-tag";
      tag.style.fontSize = `${size}px`;
      tag.textContent = keyword;
      tag.title = `Keyword: ${keyword}`;
      elements.keywordsCloud.appendChild(tag);
    });
  }

  // Show sentiment analysis if available
  if (analysis.analysis.sentiment) {
    elements.sentimentAnalysis.innerHTML = formatMarkdown(
      analysis.analysis.sentiment
    );
  }

  // Show entities if available
  if (analysis.analysis.entities) {
    if (typeof analysis.analysis.entities === "string") {
      elements.entitiesAnalysis.innerHTML = formatMarkdown(
        analysis.analysis.entities
      );
    } else {
      let html = "<h4 class='font-semibold mb-2'>Named Entities</h4>";

      if (analysis.analysis.entities.people?.length > 0) {
        html += `<p class='mb-1'><strong>People:</strong> ${analysis.analysis.entities.people.join(
          ", "
        )}</p>`;
      }

      if (analysis.analysis.entities.organizations?.length > 0) {
        html += `<p class='mb-1'><strong>Organizations:</strong> ${analysis.analysis.entities.organizations.join(
          ", "
        )}</p>`;
      }

      if (analysis.analysis.entities.locations?.length > 0) {
        html += `<p class='mb-1'><strong>Locations:</strong> ${analysis.analysis.entities.locations.join(
          ", "
        )}</p>`;
      }

      if (analysis.analysis.entities.dates?.length > 0) {
        html += `<p class='mb-1'><strong>Dates:</strong> ${analysis.analysis.entities.dates.join(
          ", "
        )}</p>`;
      }

      elements.entitiesAnalysis.innerHTML = html;
    }
  }

  // Show text metrics
  const metrics = analysis.analysis.metrics;
  elements.textMetrics.innerHTML = `
        <h4 class="font-semibold mb-2">Text Metrics</h4>
        <ul class="space-y-1">
            <li><strong>Words:</strong> ${metrics.wordCount}</li>
            <li><strong>Sentences:</strong> ${metrics.sentenceCount}</li>
            <li><strong>Paragraphs:</strong> ${metrics.paragraphCount}</li>
            <li><strong>Avg. Word Length:</strong> ${metrics.avgWordLength} characters</li>
            <li><strong>Avg. Sentence Length:</strong> ${metrics.avgSentenceLength} words</li>
            <li><strong>Lexical Diversity:</strong> ${metrics.lexicalDiversity}</li>
        </ul>
    `;

  // Show readability score
  const readability = analysis.analysis.readability;
  elements.readabilityScore.innerHTML = `
        <h4 class="font-semibold mb-2">Readability</h4>
        <div class="mb-2">
            <div class="flex justify-between mb-1">
                <span>Flesch-Kincaid Score:</span>
                <span class="font-semibold">${readability.score}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div class="bg-blue-600 h-2.5 rounded-full" 
                     style="width: ${Math.max(
                       0,
                       Math.min(100, readability.score)
                     )}%"></div>
            </div>
        </div>
        <p><strong>Level:</strong> ${readability.level}</p>
    `;

  // Show generated questions if available
  if (analysis.analysis.questions) {
    elements.questionsGenerated.innerHTML = formatMarkdown(
      analysis.analysis.questions
    );
  }

  // Show translation if available
  if (analysis.analysis.translation) {
    elements.translationResult.innerHTML = `
            <h4 class="font-semibold mb-2">Translation to ${getLanguageName(
              analysis.options.targetLanguage
            )}</h4>
            <div class="bg-white/95 p-4 rounded-lg">${
              analysis.analysis.translation
            }</div>
        `;
    elements.translationResult.classList.remove("hidden");
  } else {
    elements.translationResult.classList.add("hidden");
  }

  // Show table of contents if available
  if (analysis.analysis.toc) {
    elements.tocContainer.innerHTML = analysis.analysis.toc;
  }

  // Show original text
  elements.originalText.textContent = analysis.originalText;

  // Show output section
  elements.outputSection.classList.remove("hidden");
  switchTab("summary");
}

function formatMarkdown(text) {
  // Simple markdown to HTML conversion
  if (!text) return "";

  // Headers
  text = text.replace(/^# (.*$)/gm, "<h2>$1</h2>");
  text = text.replace(/^## (.*$)/gm, "<h3>$1</h3>");
  text = text.replace(/^### (.*$)/gm, "<h4>$1</h4>");

  // Bold and italic
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Lists
  text = text.replace(/^\s*\*\s(.*$)/gm, "<li>$1</li>");
  text = text.replace(/^\s*-\s(.*$)/gm, "<li>$1</li>");
  text = text.replace(/^\s*\+\s(.*$)/gm, "<li>$1</li>");

  // Handle paragraphs
  text = text
    .split("\n\n")
    .map((paragraph) => {
      if (
        !paragraph.match(/^<[a-z][a-z0-9]*>/) &&
        !paragraph.match(/^<\/?[a-z][a-z0-9]*>$/)
      ) {
        return `<p>${paragraph}</p>`;
      }
      return paragraph;
    })
    .join("\n\n");

  // Handle line breaks within paragraphs
  text = text.replace(/\n/g, "<br>");

  return text;
}

function switchTab(tabName) {
  // Update active tab button
  document.querySelectorAll(".tab-button").forEach((button) => {
    if (button.dataset.tab === tabName) {
      button.classList.add("active");
      button.classList.remove("text-white/70");
      button.classList.add("text-white");
    } else {
      button.classList.remove("active");
      button.classList.add("text-white/70");
      button.classList.remove("text-white");
    }
  });

  // Show active tab content
  document.querySelectorAll(".tab-content").forEach((content) => {
    if (content.id === `${tabName}Tab`) {
      content.classList.add("active");
    } else {
      content.classList.remove("active");
    }
  });
}

function setLoading(isLoading) {
  if (isLoading) {
    elements.btnText.classList.add("hidden");
    elements.loadingSpinner.classList.remove("hidden");
    elements.summarizeBtn.disabled = true;
    elements.compareBtn.disabled = true;
    elements.rewriteBtn.disabled = true;
  } else {
    elements.btnText.classList.remove("hidden");
    elements.loadingSpinner.classList.add("hidden");
    elements.summarizeBtn.disabled = false;
    elements.compareBtn.disabled = false;
    elements.rewriteBtn.disabled = false;
  }
}

function showProgress(percent) {
  elements.progressContainer.classList.remove("hidden");
  elements.progressBar.style.width = `${percent}%`;
}

function hideProgress() {
  elements.progressContainer.classList.add("hidden");
  elements.progressBar.style.width = "0%";
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorSection.classList.remove("hidden");
  elements.errorSection.classList.add("slide-in");
}

function hideError() {
  elements.errorSection.classList.add("hidden");
  elements.errorSection.classList.remove("slide-in");
}

function showSuccess(message) {
  // You could implement a toast notification here
  console.log("Success:", message);
}

function hideOutput() {
  elements.outputSection.classList.add("hidden");
}

function toggleAdvancedOptions() {
  elements.advancedOptions.classList.toggle("hidden");
  const icon = elements.advancedToggle.querySelector("svg");
  icon.classList.toggle("transform");
  icon.classList.toggle("rotate-180");
}

function toggleTranslationOptions() {
  elements.translationOptions.classList.toggle(
    "hidden",
    !elements.includeTranslation.checked
  );
}

function saveToHistory(analysis) {
  // Add to beginning of array
  analysisHistory.unshift(analysis);

  // Limit history size
  if (analysisHistory.length > MAX_HISTORY_ITEMS) {
    analysisHistory.pop();
  }

  // Save to localStorage
  localStorage.setItem("analysisHistory", JSON.stringify(analysisHistory));

  // Update UI
  loadAnalysisHistory();
}

function loadAnalysisHistory() {
  elements.historyList.innerHTML = "";

  if (analysisHistory.length === 0) {
    elements.historyList.innerHTML =
      '<p class="text-white/60 text-center py-4">No recent analyses</p>';
    return;
  }

  analysisHistory.forEach((item, index) => {
    const historyItem = document.createElement("div");
    historyItem.className =
      "bg-white/10 hover:bg-white/20 rounded-lg p-4 cursor-pointer transition-colors duration-200";
    historyItem.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="text-white font-medium truncate">${
                      item.options.summaryType
                    } analysis</h4>
                    <p class="text-white/60 text-sm">${new Date(
                      item.timestamp
                    ).toLocaleString()}</p>
                </div>
                <span class="text-white/50 text-xs">${Math.ceil(
                  item.originalText.length / 1000
                )}k chars</span>
            </div>
            <p class="text-white/80 text-sm mt-2 line-clamp-2">${item.originalText.substring(
              0,
              100
            )}...</p>
        `;

    historyItem.addEventListener("click", () => {
      elements.inputText.value = item.originalText;
      updateTextStats();
      currentAnalysis = item;
      showAnalysis(item);
    });

    elements.historyList.appendChild(historyItem);
  });
}

function clearAnalysisHistory() {
  if (confirm("Are you sure you want to clear your analysis history?")) {
    analysisHistory = [];
    localStorage.removeItem("analysisHistory");
    loadAnalysisHistory();
  }
}

function exportHistory() {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(analysisHistory, null, 2));
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "text-analysis-history.json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function copyToClipboard() {
  if (!currentAnalysis) return;

  const textToCopy = currentAnalysis.analysis.summary;
  navigator.clipboard
    .writeText(textToCopy)
    .then(() => {
      showSuccess("Summary copied to clipboard!");
    })
    .catch((err) => {
      showError("Failed to copy to clipboard");
    });
}

function copyOriginalToClipboard() {
  if (!currentAnalysis) return;

  const textToCopy = currentAnalysis.originalText;
  navigator.clipboard
    .writeText(textToCopy)
    .then(() => {
      showSuccess("Original text copied to clipboard!");
    })
    .catch((err) => {
      showError("Failed to copy to clipboard");
    });
}

function shareResults() {
  if (!currentAnalysis) return;

  if (navigator.share) {
    navigator
      .share({
        title: "Text Analysis Summary",
        text: currentAnalysis.analysis.summary.substring(0, 100) + "...",
        url: window.location.href,
      })
      .catch((err) => {
        showError("Error sharing: " + err.message);
      });
  } else {
    // Fallback for browsers that don't support Web Share API
    copyToClipboard();
    showSuccess("Summary copied to clipboard (sharing not supported)");
  }
}

function highlightKeyInfo() {
  if (!currentAnalysis) return;

  // Simple highlighting - in a real app you'd use more sophisticated NLP
  const text = currentAnalysis.originalText;
  let highlightedText = text;

  // Highlight numbers
  highlightedText = highlightedText.replace(
    /(\d+)/g,
    '<span class="highlight">$1</span>'
  );

  // Highlight named entities if available
  if (currentAnalysis.analysis.entities) {
    const entities = currentAnalysis.analysis.entities;

    if (entities.people) {
      entities.people.forEach((person) => {
        highlightedText = highlightedText.replace(
          new RegExp(escapeRegExp(person), "gi"),
          `<span class="entity-person">$&</span>`
        );
      });
    }

    if (entities.organizations) {
      entities.organizations.forEach((org) => {
        highlightedText = highlightedText.replace(
          new RegExp(escapeRegExp(org), "gi"),
          `<span class="entity-org">$&</span>`
        );
      });
    }

    if (entities.locations) {
      entities.locations.forEach((loc) => {
        highlightedText = highlightedText.replace(
          new RegExp(escapeRegExp(loc), "gi"),
          `<span class="entity-location">$&</span>`
        );
      });
    }

    if (entities.dates) {
      entities.dates.forEach((date) => {
        highlightedText = highlightedText.replace(
          new RegExp(escapeRegExp(date), "gi"),
          `<span class="entity-date">$&</span>`
        );
      });
    }
  }

  elements.originalText.innerHTML = highlightedText;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function compareSummaries() {
  if (analysisHistory.length < 2) {
    showError("You need at least 2 analyses in history to compare");
    return;
  }

  // In a real app, you would implement a comparison view
  // For now, we'll just show the two most recent analyses
  const latest = analysisHistory[0];
  const previous = analysisHistory[1];

  elements.summaryOutput.innerHTML = `
        <h3 class="font-semibold mb-2">Comparison of Analyses</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-white/90 p-4 rounded-lg">
                <h4 class="font-medium mb-2">Latest (${new Date(
                  latest.timestamp
                ).toLocaleString()})</h4>
                ${formatMarkdown(latest.analysis.summary)}
            </div>
            <div class="bg-white/90 p-4 rounded-lg">
                <h4 class="font-medium mb-2">Previous (${new Date(
                  previous.timestamp
                ).toLocaleString()})</h4>
                ${formatMarkdown(previous.analysis.summary)}
            </div>
        </div>
    `;

  elements.outputSection.classList.remove("hidden");
  switchTab("summary");
}

function exportResults(format) {
  if (!currentAnalysis) {
    showError("No analysis to export");
    return;
  }

  switch (format) {
    case "pdf":
      exportAsPdf();
      break;
    case "word":
      exportAsWord();
      break;
    case "json":
      exportAsJson();
      break;
    case "markdown":
      exportAsMarkdown();
      break;
    case "text":
      exportAsText();
      break;
    case "html":
      exportAsHtml();
      break;
    default:
      showError("Unsupported export format");
  }
}

function exportAsPdf() {
  // Using jsPDF library
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Text Analysis Summary", 10, 20);
  doc.setFontSize(12);

  // Add summary
  doc.text("Summary:", 10, 30);
  const splitSummary = doc.splitTextToSize(
    currentAnalysis.analysis.summary,
    180
  );
  doc.text(splitSummary, 10, 40);

  // Add metrics
  doc.text("Text Metrics:", 10, doc.autoTable.previous.finalY + 10);
  const metrics = currentAnalysis.analysis.metrics;
  const metricsText = [
    `Words: ${metrics.wordCount}`,
    `Sentences: ${metrics.sentenceCount}`,
    `Paragraphs: ${metrics.paragraphCount}`,
    `Avg. Word Length: ${metrics.avgWordLength} characters`,
    `Avg. Sentence Length: ${metrics.avgSentenceLength} words`,
    `Lexical Diversity: ${metrics.lexicalDiversity}`,
  ];
  doc.text(metricsText, 10, doc.autoTable.previous.finalY + 20);

  doc.save("text-analysis-summary.pdf");
}

function exportAsWord() {
  // In a real app, you would use a library like docx
  // This is a simplified version that creates a downloadable .docx file
  showError("Word export requires a backend service in a real application");
}

function exportAsJson() {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(currentAnalysis, null, 2));
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "text-analysis.json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function exportAsMarkdown() {
  let markdown = `# Text Analysis Summary\n\n`;
  markdown += `## Summary\n${currentAnalysis.analysis.summary}\n\n`;

  if (currentAnalysis.analysis.keywords) {
    markdown += `## Keywords\n${currentAnalysis.analysis.keywords.join(
      ", "
    )}\n\n`;
  }

  if (currentAnalysis.analysis.metrics) {
    markdown += `## Metrics\n`;
    const metrics = currentAnalysis.analysis.metrics;
    markdown += `- Words: ${metrics.wordCount}\n`;
    markdown += `- Sentences: ${metrics.sentenceCount}\n`;
    markdown += `- Paragraphs: ${metrics.paragraphCount}\n`;
    markdown += `- Avg. Word Length: ${metrics.avgWordLength} characters\n`;
    markdown += `- Avg. Sentence Length: ${metrics.avgSentenceLength} words\n`;
    markdown += `- Lexical Diversity: ${metrics.lexicalDiversity}\n\n`;
  }

  const dataStr =
    "data:text/markdown;charset=utf-8," + encodeURIComponent(markdown);
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "text-analysis.md");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function exportAsText() {
  let text = "TEXT ANALYSIS SUMMARY\n\n";
  text += "SUMMARY:\n" + currentAnalysis.analysis.summary + "\n\n";

  if (currentAnalysis.analysis.keywords) {
    text +=
      "KEYWORDS:\n" + currentAnalysis.analysis.keywords.join(", ") + "\n\n";
  }

  if (currentAnalysis.analysis.metrics) {
    text += "METRICS:\n";
    const metrics = currentAnalysis.analysis.metrics;
    text += `Words: ${metrics.wordCount}\n`;
    text += `Sentences: ${metrics.sentenceCount}\n`;
    text += `Paragraphs: ${metrics.paragraphCount}\n`;
    text += `Avg. Word Length: ${metrics.avgWordLength} characters\n`;
    text += `Avg. Sentence Length: ${metrics.avgSentenceLength} words\n`;
    text += `Lexical Diversity: ${metrics.lexicalDiversity}\n\n`;
  }

  const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "text-analysis.txt");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function exportAsHtml() {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Text Analysis Summary</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        h2 { color: #3498db; margin-top: 20px; }
        .metrics { background: #f9f9f9; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Text Analysis Summary</h1>
    <h2>Summary</h2>
    <p>${currentAnalysis.analysis.summary.replace(/\n/g, "<br>")}</p>
`;

  if (currentAnalysis.analysis.keywords) {
    html += `
    <h2>Keywords</h2>
    <p>${currentAnalysis.analysis.keywords.join(", ")}</p>
`;
  }

  if (currentAnalysis.analysis.metrics) {
    html += `
    <h2>Metrics</h2>
    <div class="metrics">
        <p><strong>Words:</strong> ${currentAnalysis.analysis.metrics.wordCount}</p>
        <p><strong>Sentences:</strong> ${currentAnalysis.analysis.metrics.sentenceCount}</p>
        <p><strong>Paragraphs:</strong> ${currentAnalysis.analysis.metrics.paragraphCount}</p>
        <p><strong>Avg. Word Length:</strong> ${currentAnalysis.analysis.metrics.avgWordLength} characters</p>
        <p><strong>Avg. Sentence Length:</strong> ${currentAnalysis.analysis.metrics.avgSentenceLength} words</p>
        <p><strong>Lexical Diversity:</strong> ${currentAnalysis.analysis.metrics.lexicalDiversity}</p>
    </div>
`;
  }

  html += `
</body>
</html>`;

  const dataStr = "data:text/html;charset=utf-8," + encodeURIComponent(html);
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "text-analysis.html");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}
