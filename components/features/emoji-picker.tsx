/**
 * Emoji Picker Component
 * @description Popover-based emoji picker with categorized tabs, search functionality,
 * and a recent-emojis section. Mirrors LinkedIn's emoji palette.
 * @module components/features/emoji-picker
 */

"use client"

import * as React from "react"
import {
  IconBriefcase,
  IconBuilding,
  IconCar,
  IconClock,
  IconDeviceGamepad2,
  IconFlag,
  IconLeaf,
  IconMoodSmile,
  IconPizza,
  IconSearch,
  IconStar,
  IconUser,
  IconX,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

/**
 * Emoji entry with the emoji character and searchable keywords.
 */
interface EmojiEntry {
  /** The emoji character */
  emoji: string
  /** Searchable keywords/names for this emoji */
  keywords: string[]
}

/**
 * Emoji category definition with id, label, icon, and emoji entries.
 */
export interface EmojiCategory {
  /** Unique identifier for the category */
  id: string
  /** Display label for the category */
  label: string
  /** Icon component for the category tab */
  icon: React.ElementType
  /** Array of emoji entries in this category */
  emojis: EmojiEntry[]
}

/**
 * Props for the EmojiPicker component.
 */
export interface EmojiPickerProps {
  /** Callback fired when an emoji is selected */
  onSelect: (emoji: string) => void
  /** Whether the popover is currently open */
  isOpen: boolean
  /** Callback fired when the popover should be closed */
  onClose: () => void
  /** Callback fired when the popover open state changes */
  onOpenChange?: (open: boolean) => void
  /** Reference to the trigger element for positioning, optional */
  triggerRef?: React.RefObject<HTMLElement>
  /** Additional CSS classes to apply to the popover content */
  className?: string
  /** The trigger element to open the picker */
  children?: React.ReactNode
}

/**
 * Comprehensive emoji dataset matching LinkedIn's emoji palette.
 * Each emoji has searchable keywords for real search functionality.
 */
export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "smileys",
    label: "Smileys & Emotion",
    icon: IconMoodSmile,
    emojis: [
      { emoji: "\u{1F600}", keywords: ["grinning", "face", "smile", "happy"] },
      { emoji: "\u{1F603}", keywords: ["grinning", "big eyes", "smile", "happy"] },
      { emoji: "\u{1F604}", keywords: ["grinning", "smiling eyes", "happy"] },
      { emoji: "\u{1F601}", keywords: ["beaming", "grin", "happy"] },
      { emoji: "\u{1F606}", keywords: ["squinting", "laughing", "lol"] },
      { emoji: "\u{1F605}", keywords: ["grinning", "sweat", "nervous"] },
      { emoji: "\u{1F602}", keywords: ["joy", "tears", "laughing", "lol", "crying laughing"] },
      { emoji: "\u{1F923}", keywords: ["rofl", "rolling", "floor", "laughing"] },
      { emoji: "\u{1F972}", keywords: ["smiling", "tear", "grateful", "touched"] },
      { emoji: "\u{263A}\u{FE0F}", keywords: ["smiling", "relaxed", "warm"] },
      { emoji: "\u{1F60A}", keywords: ["blush", "smiling", "happy", "pleased"] },
      { emoji: "\u{1F607}", keywords: ["halo", "angel", "innocent", "blessed"] },
      { emoji: "\u{1F642}", keywords: ["slightly smiling", "fine", "ok"] },
      { emoji: "\u{1F643}", keywords: ["upside down", "sarcasm", "irony"] },
      { emoji: "\u{1F609}", keywords: ["wink", "winking", "flirt"] },
      { emoji: "\u{1F60C}", keywords: ["relieved", "content", "peaceful"] },
      { emoji: "\u{1F60D}", keywords: ["heart eyes", "love", "crush", "adore"] },
      { emoji: "\u{1F970}", keywords: ["smiling", "hearts", "love", "adore"] },
      { emoji: "\u{1F618}", keywords: ["kiss", "blowing kiss", "love"] },
      { emoji: "\u{1F617}", keywords: ["kissing", "pucker"] },
      { emoji: "\u{1F619}", keywords: ["kissing", "smiling eyes"] },
      { emoji: "\u{1F61A}", keywords: ["kissing", "closed eyes"] },
      { emoji: "\u{1F60B}", keywords: ["yummy", "delicious", "tongue", "food"] },
      { emoji: "\u{1F61B}", keywords: ["tongue", "playful"] },
      { emoji: "\u{1F61C}", keywords: ["wink", "tongue", "crazy", "playful"] },
      { emoji: "\u{1F92A}", keywords: ["zany", "crazy", "wild", "goofy"] },
      { emoji: "\u{1F61D}", keywords: ["squinting", "tongue", "playful", "silly"] },
      { emoji: "\u{1F911}", keywords: ["money", "mouth", "rich", "dollar"] },
      { emoji: "\u{1F917}", keywords: ["hug", "hugging", "open hands", "warm"] },
      { emoji: "\u{1F92D}", keywords: ["shush", "hand over mouth", "secret", "oops"] },
      { emoji: "\u{1FAE2}", keywords: ["peeking", "shy", "hiding"] },
      { emoji: "\u{1FAE3}", keywords: ["salute", "saluting", "respect"] },
      { emoji: "\u{1F914}", keywords: ["thinking", "hmm", "wondering", "pondering"] },
      { emoji: "\u{1F910}", keywords: ["zipper", "mouth", "quiet", "secret", "shh"] },
      { emoji: "\u{1F928}", keywords: ["raised eyebrow", "skeptical", "suspicious"] },
      { emoji: "\u{1F610}", keywords: ["neutral", "meh", "straight face"] },
      { emoji: "\u{1F611}", keywords: ["expressionless", "blank", "unimpressed"] },
      { emoji: "\u{1F636}", keywords: ["no mouth", "speechless", "silent"] },
      { emoji: "\u{1FAE5}", keywords: ["dotted line", "invisible", "hidden"] },
      { emoji: "\u{1F60F}", keywords: ["smirk", "smug", "sly"] },
      { emoji: "\u{1F612}", keywords: ["unamused", "annoyed", "unimpressed"] },
      { emoji: "\u{1F644}", keywords: ["rolling eyes", "whatever", "annoyed"] },
      { emoji: "\u{1F62C}", keywords: ["grimace", "awkward", "nervous"] },
      { emoji: "\u{1F62E}\u{200D}\u{1F4A8}", keywords: ["exhale", "sigh", "relief", "breath"] },
      { emoji: "\u{1F925}", keywords: ["lying", "pinocchio", "liar"] },
      { emoji: "\u{1F60E}", keywords: ["cool", "sunglasses", "confident"] },
      { emoji: "\u{1F913}", keywords: ["nerd", "glasses", "geek", "smart"] },
      { emoji: "\u{1F978}", keywords: ["disguise", "detective", "incognito"] },
      { emoji: "\u{1F9D0}", keywords: ["monocle", "fancy", "hmm", "inspect"] },
      { emoji: "\u{1F615}", keywords: ["confused", "puzzled"] },
      { emoji: "\u{1FAE4}", keywords: ["melting", "hot", "embarrassed", "disappearing"] },
      { emoji: "\u{1F61F}", keywords: ["worried", "anxious", "concerned"] },
      { emoji: "\u{1F641}", keywords: ["slightly frowning", "sad", "disappointed"] },
      { emoji: "\u{2639}\u{FE0F}", keywords: ["frowning", "sad", "unhappy"] },
      { emoji: "\u{1F62E}", keywords: ["open mouth", "surprised", "wow"] },
      { emoji: "\u{1F62F}", keywords: ["hushed", "stunned", "shocked"] },
      { emoji: "\u{1F632}", keywords: ["astonished", "shocked", "amazed"] },
      { emoji: "\u{1F633}", keywords: ["flushed", "embarrassed", "blushing"] },
      { emoji: "\u{1F97A}", keywords: ["pleading", "puppy eyes", "please", "begging"] },
      { emoji: "\u{1F979}", keywords: ["holding back tears", "sad", "emotional"] },
      { emoji: "\u{1F626}", keywords: ["frowning", "open mouth", "anguish"] },
      { emoji: "\u{1F627}", keywords: ["anguished", "pain", "distress"] },
      { emoji: "\u{1F628}", keywords: ["fearful", "scared", "afraid"] },
      { emoji: "\u{1F630}", keywords: ["anxious", "sweat", "worried"] },
      { emoji: "\u{1F625}", keywords: ["sad", "relieved", "disappointed"] },
      { emoji: "\u{1F622}", keywords: ["cry", "crying", "sad", "tear"] },
      { emoji: "\u{1F62D}", keywords: ["sobbing", "loud crying", "wailing"] },
      { emoji: "\u{1F631}", keywords: ["scream", "horror", "shocked", "scared"] },
      { emoji: "\u{1F616}", keywords: ["confounded", "frustrated"] },
      { emoji: "\u{1F623}", keywords: ["persevere", "struggling"] },
      { emoji: "\u{1F61E}", keywords: ["disappointed", "sad"] },
      { emoji: "\u{1F613}", keywords: ["downcast", "sweat", "hard work"] },
      { emoji: "\u{1F629}", keywords: ["weary", "tired", "exhausted"] },
      { emoji: "\u{1F62B}", keywords: ["tired", "exhausted", "sleepy"] },
      { emoji: "\u{1F971}", keywords: ["yawn", "yawning", "boring", "tired"] },
      { emoji: "\u{1F624}", keywords: ["triumph", "steam", "determined", "angry"] },
      { emoji: "\u{1F620}", keywords: ["angry", "mad", "furious"] },
      { emoji: "\u{1F621}", keywords: ["pouting", "rage", "red angry"] },
      { emoji: "\u{1F92C}", keywords: ["cursing", "swearing", "angry", "symbols"] },
      { emoji: "\u{1F608}", keywords: ["devil", "smiling", "horns", "evil"] },
      { emoji: "\u{1F47F}", keywords: ["angry devil", "demon", "evil"] },
      { emoji: "\u{1F480}", keywords: ["skull", "death", "dead", "skeleton"] },
      { emoji: "\u{2620}\u{FE0F}", keywords: ["skull", "crossbones", "danger", "death"] },
      { emoji: "\u{1F4A9}", keywords: ["poop", "poo", "shit", "funny"] },
      { emoji: "\u{1F921}", keywords: ["clown", "circus", "silly"] },
      { emoji: "\u{1F47B}", keywords: ["ghost", "halloween", "boo"] },
      { emoji: "\u{1F47D}", keywords: ["alien", "ufo", "space"] },
      { emoji: "\u{1F916}", keywords: ["robot", "machine", "ai", "tech"] },
      { emoji: "\u{1F63A}", keywords: ["cat", "grinning", "happy cat"] },
      { emoji: "\u{1F4AF}", keywords: ["hundred", "perfect", "score", "100"] },
      { emoji: "\u{1F4A5}", keywords: ["boom", "collision", "explosion"] },
      { emoji: "\u{1F4AB}", keywords: ["dizzy", "stars", "sparkle"] },
      { emoji: "\u{2728}", keywords: ["sparkles", "magic", "shine", "glitter", "new"] },
      { emoji: "\u{1F4A2}", keywords: ["anger", "symbol", "vein"] },
      { emoji: "\u{1F4A6}", keywords: ["sweat", "drops", "water"] },
      { emoji: "\u{1F4A8}", keywords: ["dash", "wind", "running", "fast"] },
      { emoji: "\u{1F573}\u{FE0F}", keywords: ["hole", "opening"] },
      { emoji: "\u{1F4A3}", keywords: ["bomb", "explosive"] },
      { emoji: "\u{1F4AC}", keywords: ["speech", "bubble", "talk", "comment"] },
      { emoji: "\u{1F4AD}", keywords: ["thought", "bubble", "thinking"] },
      { emoji: "\u{1F4A4}", keywords: ["zzz", "sleep", "tired", "rest"] },
    ],
  },
  {
    id: "people",
    label: "People & Body",
    icon: IconUser,
    emojis: [
      { emoji: "\u{1F44B}", keywords: ["wave", "waving", "hand", "hello", "goodbye"] },
      { emoji: "\u{1F91A}", keywords: ["raised back", "hand", "stop"] },
      { emoji: "\u{1F590}\u{FE0F}", keywords: ["fingers splayed", "hand", "high five"] },
      { emoji: "\u{270B}", keywords: ["raised hand", "stop", "high five"] },
      { emoji: "\u{1F596}", keywords: ["vulcan", "spock", "star trek"] },
      { emoji: "\u{1FAF1}", keywords: ["rightward", "hand"] },
      { emoji: "\u{1FAF2}", keywords: ["leftward", "hand"] },
      { emoji: "\u{1FAF3}", keywords: ["palm down", "hand"] },
      { emoji: "\u{1FAF4}", keywords: ["palm up", "hand"] },
      { emoji: "\u{1F44C}", keywords: ["ok", "perfect", "fine", "chef kiss"] },
      { emoji: "\u{1F90C}", keywords: ["pinched", "fingers", "italian"] },
      { emoji: "\u{1F90F}", keywords: ["pinching", "small", "tiny", "little bit"] },
      { emoji: "\u{270C}\u{FE0F}", keywords: ["peace", "victory", "v sign"] },
      { emoji: "\u{1F91E}", keywords: ["crossed fingers", "luck", "hope"] },
      { emoji: "\u{1FAF0}", keywords: ["hand", "finger", "point"] },
      { emoji: "\u{1F91F}", keywords: ["love you", "hand", "ily"] },
      { emoji: "\u{1F918}", keywords: ["rock", "horns", "metal", "rock on"] },
      { emoji: "\u{1F919}", keywords: ["call me", "shaka", "hang loose"] },
      { emoji: "\u{1F448}", keywords: ["left", "pointing", "direction"] },
      { emoji: "\u{1F449}", keywords: ["right", "pointing", "direction", "this"] },
      { emoji: "\u{1F446}", keywords: ["up", "pointing"] },
      { emoji: "\u{1F595}", keywords: ["middle finger"] },
      { emoji: "\u{1F447}", keywords: ["down", "pointing"] },
      { emoji: "\u{261D}\u{FE0F}", keywords: ["index", "pointing up", "one", "number one"] },
      { emoji: "\u{1FAF5}", keywords: ["index pointing", "viewer", "you"] },
      { emoji: "\u{1F44D}", keywords: ["thumbs up", "like", "approve", "yes", "good"] },
      { emoji: "\u{1F44E}", keywords: ["thumbs down", "dislike", "no", "bad"] },
      { emoji: "\u{270A}", keywords: ["fist", "punch", "raised fist", "power"] },
      { emoji: "\u{1F44A}", keywords: ["fist bump", "punch"] },
      { emoji: "\u{1F91B}", keywords: ["left fist", "fist bump"] },
      { emoji: "\u{1F91C}", keywords: ["right fist", "fist bump"] },
      { emoji: "\u{1F44F}", keywords: ["clap", "clapping", "applause", "bravo"] },
      { emoji: "\u{1F64C}", keywords: ["raising hands", "celebration", "hooray", "praise"] },
      { emoji: "\u{1FAF6}", keywords: ["heart hands", "love", "hand heart"] },
      { emoji: "\u{1F450}", keywords: ["open hands", "jazz hands"] },
      { emoji: "\u{1F932}", keywords: ["palms up", "prayer", "cupped hands"] },
      { emoji: "\u{1F91D}", keywords: ["handshake", "deal", "agreement", "partnership"] },
      { emoji: "\u{1F64F}", keywords: ["pray", "prayer", "please", "thank you", "namaste", "folded hands"] },
      { emoji: "\u{270D}\u{FE0F}", keywords: ["writing", "hand", "pen", "sign"] },
      { emoji: "\u{1F485}", keywords: ["nail polish", "beauty", "manicure"] },
      { emoji: "\u{1F933}", keywords: ["selfie", "camera", "phone"] },
      { emoji: "\u{1F4AA}", keywords: ["muscle", "flexed bicep", "strong", "strength", "workout"] },
      { emoji: "\u{1F9BE}", keywords: ["mechanical arm", "prosthetic", "robot"] },
      { emoji: "\u{1F9B5}", keywords: ["leg", "kick"] },
      { emoji: "\u{1F9B6}", keywords: ["foot", "kick", "stomp"] },
      { emoji: "\u{1F442}", keywords: ["ear", "listen", "hearing"] },
      { emoji: "\u{1F443}", keywords: ["nose", "smell", "sniff"] },
      { emoji: "\u{1F9E0}", keywords: ["brain", "smart", "intelligent", "think", "mind"] },
      { emoji: "\u{1F441}\u{FE0F}", keywords: ["eye", "see", "look", "watch"] },
      { emoji: "\u{1F440}", keywords: ["eyes", "look", "see", "watching", "shifty"] },
      { emoji: "\u{1F445}", keywords: ["tongue", "taste", "lick"] },
      { emoji: "\u{1F444}", keywords: ["mouth", "lips", "kiss"] },
      { emoji: "\u{1FAE6}", keywords: ["biting lip", "nervous", "flirt"] },
      { emoji: "\u{1F476}", keywords: ["baby", "child", "infant"] },
      { emoji: "\u{1F9D2}", keywords: ["child", "kid", "young"] },
      { emoji: "\u{1F466}", keywords: ["boy", "male child"] },
      { emoji: "\u{1F467}", keywords: ["girl", "female child"] },
      { emoji: "\u{1F9D1}", keywords: ["person", "adult", "gender neutral"] },
      { emoji: "\u{1F468}", keywords: ["man", "male", "guy"] },
      { emoji: "\u{1F469}", keywords: ["woman", "female", "girl"] },
      { emoji: "\u{1F474}", keywords: ["old man", "elderly", "grandpa"] },
      { emoji: "\u{1F475}", keywords: ["old woman", "elderly", "grandma"] },
      { emoji: "\u{1F64D}", keywords: ["frowning person", "upset"] },
      { emoji: "\u{1F64E}", keywords: ["pouting person", "angry"] },
      { emoji: "\u{1F645}", keywords: ["no good", "gesturing no", "not ok"] },
      { emoji: "\u{1F646}", keywords: ["ok gesture", "yes", "ok"] },
      { emoji: "\u{1F481}", keywords: ["information desk", "sassy", "help"] },
      { emoji: "\u{1F64B}", keywords: ["raising hand", "question", "volunteer"] },
      { emoji: "\u{1F647}", keywords: ["bow", "bowing", "respect", "sorry"] },
      { emoji: "\u{1F926}", keywords: ["facepalm", "disbelief", "smh"] },
      { emoji: "\u{1F937}", keywords: ["shrug", "shrugging", "idk", "whatever"] },
      { emoji: "\u{1F46B}", keywords: ["couple", "man woman", "holding hands"] },
      { emoji: "\u{1F46C}", keywords: ["two men", "holding hands"] },
      { emoji: "\u{1F46D}", keywords: ["two women", "holding hands"] },
    ],
  },
  {
    id: "nature",
    label: "Animals & Nature",
    icon: IconLeaf,
    emojis: [
      { emoji: "\u{1F436}", keywords: ["dog", "puppy", "pet", "cute"] },
      { emoji: "\u{1F431}", keywords: ["cat", "kitten", "pet", "cute"] },
      { emoji: "\u{1F42D}", keywords: ["mouse", "rat", "rodent"] },
      { emoji: "\u{1F439}", keywords: ["hamster", "pet", "cute"] },
      { emoji: "\u{1F430}", keywords: ["rabbit", "bunny", "cute"] },
      { emoji: "\u{1F98A}", keywords: ["fox", "clever", "sly"] },
      { emoji: "\u{1F43B}", keywords: ["bear", "grizzly"] },
      { emoji: "\u{1F43C}", keywords: ["panda", "bear", "cute"] },
      { emoji: "\u{1F428}", keywords: ["koala", "cute", "australia"] },
      { emoji: "\u{1F42F}", keywords: ["tiger", "cat", "fierce"] },
      { emoji: "\u{1F981}", keywords: ["lion", "king", "fierce", "brave"] },
      { emoji: "\u{1F984}", keywords: ["unicorn", "magic", "fantasy", "rainbow"] },
      { emoji: "\u{1F993}", keywords: ["zebra", "stripes"] },
      { emoji: "\u{1F98C}", keywords: ["deer", "nature", "bambi"] },
      { emoji: "\u{1F9AC}", keywords: ["bison", "buffalo"] },
      { emoji: "\u{1F42E}", keywords: ["cow", "farm", "milk"] },
      { emoji: "\u{1F437}", keywords: ["pig", "farm", "cute"] },
      { emoji: "\u{1F438}", keywords: ["frog", "toad", "ribbit"] },
      { emoji: "\u{1F435}", keywords: ["monkey", "chimp", "ape"] },
      { emoji: "\u{1F648}", keywords: ["see no evil", "monkey", "blind"] },
      { emoji: "\u{1F649}", keywords: ["hear no evil", "monkey", "deaf"] },
      { emoji: "\u{1F64A}", keywords: ["speak no evil", "monkey", "mute"] },
      { emoji: "\u{1F412}", keywords: ["monkey", "primate"] },
      { emoji: "\u{1F414}", keywords: ["chicken", "hen", "poultry"] },
      { emoji: "\u{1F427}", keywords: ["penguin", "cold", "arctic"] },
      { emoji: "\u{1F426}", keywords: ["bird", "tweet", "chirp"] },
      { emoji: "\u{1F985}", keywords: ["eagle", "bird", "freedom", "america"] },
      { emoji: "\u{1F986}", keywords: ["duck", "bird", "quack"] },
      { emoji: "\u{1F989}", keywords: ["owl", "wise", "night", "bird"] },
      { emoji: "\u{1F9A9}", keywords: ["flamingo", "pink", "bird"] },
      { emoji: "\u{1F40A}", keywords: ["crocodile", "alligator", "reptile"] },
      { emoji: "\u{1F422}", keywords: ["turtle", "slow", "shell"] },
      { emoji: "\u{1F40D}", keywords: ["snake", "reptile"] },
      { emoji: "\u{1F409}", keywords: ["dragon", "fantasy", "fire"] },
      { emoji: "\u{1F996}", keywords: ["t-rex", "dinosaur", "rawr"] },
      { emoji: "\u{1F995}", keywords: ["sauropod", "dinosaur", "brontosaurus"] },
      { emoji: "\u{1F433}", keywords: ["whale", "ocean", "sea"] },
      { emoji: "\u{1F42C}", keywords: ["dolphin", "ocean", "smart"] },
      { emoji: "\u{1F41F}", keywords: ["fish", "ocean", "sea"] },
      { emoji: "\u{1F420}", keywords: ["tropical fish", "nemo"] },
      { emoji: "\u{1F988}", keywords: ["shark", "ocean", "danger"] },
      { emoji: "\u{1F419}", keywords: ["octopus", "ocean", "tentacles"] },
      { emoji: "\u{1F41A}", keywords: ["shell", "beach", "ocean"] },
      { emoji: "\u{1F40C}", keywords: ["snail", "slow"] },
      { emoji: "\u{1F98B}", keywords: ["butterfly", "nature", "beautiful"] },
      { emoji: "\u{1F41B}", keywords: ["bug", "caterpillar", "insect"] },
      { emoji: "\u{1F41D}", keywords: ["bee", "honeybee", "buzz", "busy"] },
      { emoji: "\u{1F41E}", keywords: ["ladybug", "insect", "luck"] },
      { emoji: "\u{1F490}", keywords: ["bouquet", "flowers", "gift"] },
      { emoji: "\u{1F338}", keywords: ["cherry blossom", "spring", "japan", "flower"] },
      { emoji: "\u{1F4AE}", keywords: ["white flower", "brilliant"] },
      { emoji: "\u{1F339}", keywords: ["rose", "flower", "love", "romantic"] },
      { emoji: "\u{1F33A}", keywords: ["hibiscus", "flower", "tropical"] },
      { emoji: "\u{1F33B}", keywords: ["sunflower", "flower", "sunny", "happy"] },
      { emoji: "\u{1F337}", keywords: ["tulip", "flower", "spring"] },
      { emoji: "\u{1F331}", keywords: ["seedling", "sprout", "growth", "plant", "new"] },
      { emoji: "\u{1FAB4}", keywords: ["potted plant", "house plant", "green"] },
      { emoji: "\u{1F332}", keywords: ["evergreen", "tree", "pine", "christmas"] },
      { emoji: "\u{1F333}", keywords: ["deciduous tree", "nature"] },
      { emoji: "\u{1F334}", keywords: ["palm tree", "beach", "tropical"] },
      { emoji: "\u{1F335}", keywords: ["cactus", "desert"] },
      { emoji: "\u{1F340}", keywords: ["four leaf clover", "luck", "lucky", "irish"] },
      { emoji: "\u{2618}\u{FE0F}", keywords: ["shamrock", "irish", "clover"] },
      { emoji: "\u{1F341}", keywords: ["maple leaf", "fall", "autumn", "canada"] },
      { emoji: "\u{1F342}", keywords: ["fallen leaf", "autumn"] },
      { emoji: "\u{1F343}", keywords: ["leaf fluttering", "wind", "nature"] },
    ],
  },
  {
    id: "food",
    label: "Food & Drink",
    icon: IconPizza,
    emojis: [
      { emoji: "\u{1F34E}", keywords: ["apple", "red", "fruit", "healthy"] },
      { emoji: "\u{1F34F}", keywords: ["green apple", "fruit", "healthy"] },
      { emoji: "\u{1F34A}", keywords: ["orange", "tangerine", "fruit"] },
      { emoji: "\u{1F34B}", keywords: ["lemon", "citrus", "sour"] },
      { emoji: "\u{1F34C}", keywords: ["banana", "fruit"] },
      { emoji: "\u{1F34D}", keywords: ["pineapple", "fruit", "tropical"] },
      { emoji: "\u{1F96D}", keywords: ["mango", "fruit", "tropical"] },
      { emoji: "\u{1F347}", keywords: ["grapes", "wine", "fruit"] },
      { emoji: "\u{1F353}", keywords: ["strawberry", "fruit", "berry"] },
      { emoji: "\u{1FAD0}", keywords: ["blueberry", "berry", "fruit"] },
      { emoji: "\u{1F351}", keywords: ["peach", "fruit", "butt"] },
      { emoji: "\u{1F352}", keywords: ["cherries", "fruit"] },
      { emoji: "\u{1F349}", keywords: ["watermelon", "summer", "fruit"] },
      { emoji: "\u{1F95D}", keywords: ["kiwi", "fruit"] },
      { emoji: "\u{1F345}", keywords: ["tomato", "vegetable", "red"] },
      { emoji: "\u{1F965}", keywords: ["coconut", "tropical"] },
      { emoji: "\u{1F951}", keywords: ["avocado", "guacamole", "millennial"] },
      { emoji: "\u{1F346}", keywords: ["eggplant", "aubergine"] },
      { emoji: "\u{1F336}\u{FE0F}", keywords: ["hot pepper", "spicy", "chili"] },
      { emoji: "\u{1F33D}", keywords: ["corn", "maize"] },
      { emoji: "\u{1F955}", keywords: ["carrot", "vegetable"] },
      { emoji: "\u{1F9C5}", keywords: ["onion", "cry"] },
      { emoji: "\u{1F9C4}", keywords: ["garlic", "cook"] },
      { emoji: "\u{1F950}", keywords: ["croissant", "bread", "french", "pastry"] },
      { emoji: "\u{1F35E}", keywords: ["bread", "loaf", "toast"] },
      { emoji: "\u{1F956}", keywords: ["baguette", "french bread"] },
      { emoji: "\u{1F9C0}", keywords: ["cheese", "cheddar"] },
      { emoji: "\u{1F95A}", keywords: ["egg", "breakfast"] },
      { emoji: "\u{1F953}", keywords: ["bacon", "breakfast", "meat"] },
      { emoji: "\u{1F969}", keywords: ["steak", "meat", "beef"] },
      { emoji: "\u{1F354}", keywords: ["hamburger", "burger", "fast food"] },
      { emoji: "\u{1F35F}", keywords: ["fries", "french fries", "chips"] },
      { emoji: "\u{1F355}", keywords: ["pizza", "fast food", "italian"] },
      { emoji: "\u{1F32D}", keywords: ["hot dog", "sausage"] },
      { emoji: "\u{1F96A}", keywords: ["sandwich", "lunch", "sub"] },
      { emoji: "\u{1F32E}", keywords: ["taco", "mexican"] },
      { emoji: "\u{1F32F}", keywords: ["burrito", "mexican", "wrap"] },
      { emoji: "\u{1F959}", keywords: ["falafel", "stuffed flatbread"] },
      { emoji: "\u{1F35D}", keywords: ["spaghetti", "pasta", "noodles", "italian"] },
      { emoji: "\u{1F35C}", keywords: ["ramen", "noodles", "soup", "bowl"] },
      { emoji: "\u{1F363}", keywords: ["sushi", "japanese", "fish"] },
      { emoji: "\u{1F371}", keywords: ["bento", "box", "japanese", "lunch"] },
      { emoji: "\u{1F35B}", keywords: ["curry", "rice", "indian"] },
      { emoji: "\u{1F37F}", keywords: ["popcorn", "movie", "snack"] },
      { emoji: "\u{1F366}", keywords: ["ice cream", "soft serve", "dessert"] },
      { emoji: "\u{1F370}", keywords: ["cake", "shortcake", "dessert", "birthday"] },
      { emoji: "\u{1F382}", keywords: ["birthday cake", "celebration", "party"] },
      { emoji: "\u{1F36B}", keywords: ["chocolate", "candy", "sweet"] },
      { emoji: "\u{1F36C}", keywords: ["candy", "sweet", "sugar"] },
      { emoji: "\u{1F36D}", keywords: ["lollipop", "candy", "sweet"] },
      { emoji: "\u{1F36E}", keywords: ["custard", "pudding", "dessert"] },
      { emoji: "\u{1F36F}", keywords: ["honey", "pot", "sweet"] },
      { emoji: "\u{2615}", keywords: ["coffee", "tea", "hot", "drink", "cafe", "morning"] },
      { emoji: "\u{1FAD6}", keywords: ["teapot", "tea"] },
      { emoji: "\u{1F375}", keywords: ["tea", "green tea", "matcha", "cup"] },
      { emoji: "\u{1F37A}", keywords: ["beer", "mug", "drink", "alcohol", "bar"] },
      { emoji: "\u{1F37B}", keywords: ["beers", "cheers", "toast", "drink"] },
      { emoji: "\u{1F377}", keywords: ["wine", "glass", "red wine", "drink"] },
      { emoji: "\u{1F378}", keywords: ["cocktail", "martini", "drink"] },
      { emoji: "\u{1F379}", keywords: ["tropical drink", "cocktail", "summer"] },
      { emoji: "\u{1F9C3}", keywords: ["juice", "beverage box"] },
      { emoji: "\u{1F95B}", keywords: ["milk", "glass", "drink"] },
    ],
  },
  {
    id: "activities",
    label: "Activities",
    icon: IconDeviceGamepad2,
    emojis: [
      { emoji: "\u{26BD}", keywords: ["soccer", "football", "ball", "sport"] },
      { emoji: "\u{1F3C0}", keywords: ["basketball", "ball", "sport", "nba"] },
      { emoji: "\u{1F3C8}", keywords: ["football", "american", "nfl", "sport"] },
      { emoji: "\u{26BE}", keywords: ["baseball", "ball", "sport", "mlb"] },
      { emoji: "\u{1F94E}", keywords: ["softball", "ball", "sport"] },
      { emoji: "\u{1F3BE}", keywords: ["tennis", "ball", "racquet", "sport"] },
      { emoji: "\u{1F3D0}", keywords: ["volleyball", "ball", "sport"] },
      { emoji: "\u{1F3C9}", keywords: ["rugby", "ball", "sport"] },
      { emoji: "\u{1F3B1}", keywords: ["pool", "billiards", "8 ball"] },
      { emoji: "\u{1F3D3}", keywords: ["ping pong", "table tennis"] },
      { emoji: "\u{1F3F8}", keywords: ["badminton", "racquet"] },
      { emoji: "\u{1F94A}", keywords: ["boxing", "glove", "fight"] },
      { emoji: "\u{1F94B}", keywords: ["martial arts", "karate"] },
      { emoji: "\u{26F3}", keywords: ["golf", "hole", "sport"] },
      { emoji: "\u{26F8}\u{FE0F}", keywords: ["ice skating", "figure skating"] },
      { emoji: "\u{1F3A3}", keywords: ["fishing", "pole", "rod"] },
      { emoji: "\u{1F3BF}", keywords: ["skiing", "snow", "winter sport"] },
      { emoji: "\u{1F6F7}", keywords: ["sled", "sledding", "winter"] },
      { emoji: "\u{1F3AF}", keywords: ["bullseye", "target", "dart", "goal"] },
      { emoji: "\u{1F3B3}", keywords: ["bowling", "sport", "strike"] },
      { emoji: "\u{1F3C6}", keywords: ["trophy", "winner", "champion", "award", "first place"] },
      { emoji: "\u{1F3C5}", keywords: ["medal", "sports", "winner"] },
      { emoji: "\u{1F947}", keywords: ["gold medal", "first place", "winner", "champion"] },
      { emoji: "\u{1F948}", keywords: ["silver medal", "second place", "runner up"] },
      { emoji: "\u{1F949}", keywords: ["bronze medal", "third place"] },
      { emoji: "\u{1F3AE}", keywords: ["video game", "controller", "gaming"] },
      { emoji: "\u{1F579}\u{FE0F}", keywords: ["joystick", "gaming", "arcade"] },
      { emoji: "\u{1F3B2}", keywords: ["dice", "game", "chance", "gambling"] },
      { emoji: "\u{265F}\u{FE0F}", keywords: ["chess", "pawn", "strategy", "game"] },
      { emoji: "\u{1F9E9}", keywords: ["puzzle", "piece", "jigsaw"] },
      { emoji: "\u{1F3A8}", keywords: ["art", "palette", "paint", "creative", "design"] },
      { emoji: "\u{1F3AD}", keywords: ["theater", "performing arts", "drama", "masks"] },
      { emoji: "\u{1F3BC}", keywords: ["music", "score", "notes", "treble clef"] },
      { emoji: "\u{1F3B5}", keywords: ["music", "note", "song"] },
      { emoji: "\u{1F3B6}", keywords: ["music", "notes", "singing", "song"] },
      { emoji: "\u{1F3A4}", keywords: ["microphone", "singing", "karaoke", "mic"] },
      { emoji: "\u{1F3A7}", keywords: ["headphones", "music", "listening", "audio"] },
      { emoji: "\u{1F3B9}", keywords: ["piano", "keyboard", "music"] },
      { emoji: "\u{1F3B7}", keywords: ["saxophone", "music", "jazz"] },
      { emoji: "\u{1F3BA}", keywords: ["trumpet", "music", "brass"] },
      { emoji: "\u{1F3B8}", keywords: ["guitar", "music", "rock"] },
      { emoji: "\u{1F941}", keywords: ["drum", "music", "percussion", "beat"] },
    ],
  },
  {
    id: "travel",
    label: "Travel & Places",
    icon: IconCar,
    emojis: [
      { emoji: "\u{1F30D}", keywords: ["globe", "earth", "europe", "africa", "world"] },
      { emoji: "\u{1F30E}", keywords: ["globe", "earth", "americas", "world"] },
      { emoji: "\u{1F30F}", keywords: ["globe", "earth", "asia", "world"] },
      { emoji: "\u{1F30B}", keywords: ["volcano", "mountain", "eruption"] },
      { emoji: "\u{1F3D4}\u{FE0F}", keywords: ["mountain", "snow", "nature"] },
      { emoji: "\u{26F0}\u{FE0F}", keywords: ["mountain", "rock", "nature"] },
      { emoji: "\u{1F5FB}", keywords: ["mount fuji", "japan", "mountain"] },
      { emoji: "\u{1F3D5}\u{FE0F}", keywords: ["camping", "tent", "outdoors", "nature"] },
      { emoji: "\u{1F3D6}\u{FE0F}", keywords: ["beach", "umbrella", "vacation", "summer"] },
      { emoji: "\u{1F3DC}\u{FE0F}", keywords: ["desert", "sand", "cactus"] },
      { emoji: "\u{1F3DD}\u{FE0F}", keywords: ["island", "tropical", "paradise"] },
      { emoji: "\u{1F3DF}\u{FE0F}", keywords: ["stadium", "sports", "arena"] },
      { emoji: "\u{1F3E0}", keywords: ["house", "home"] },
      { emoji: "\u{1F3E2}", keywords: ["office", "building", "work", "business"] },
      { emoji: "\u{1F3E5}", keywords: ["hospital", "medical", "health"] },
      { emoji: "\u{1F3EB}", keywords: ["school", "education", "learning"] },
      { emoji: "\u{1F3EA}", keywords: ["store", "shop", "convenience"] },
      { emoji: "\u{1F3E8}", keywords: ["hotel", "travel", "accommodation"] },
      { emoji: "\u{26EA}", keywords: ["church", "religion"] },
      { emoji: "\u{1F54C}", keywords: ["mosque", "religion", "islam"] },
      { emoji: "\u{1F3EF}", keywords: ["japanese castle", "japan"] },
      { emoji: "\u{1F5FC}", keywords: ["tokyo tower", "japan"] },
      { emoji: "\u{1F5FD}", keywords: ["statue of liberty", "usa", "america", "new york"] },
      { emoji: "\u{26F2}", keywords: ["fountain", "water"] },
      { emoji: "\u{26F5}", keywords: ["sailboat", "boat", "ocean", "sailing"] },
      { emoji: "\u{1F6F6}", keywords: ["canoe", "kayak", "boat"] },
      { emoji: "\u{1F6A2}", keywords: ["ship", "cruise", "ocean"] },
      { emoji: "\u{2708}\u{FE0F}", keywords: ["airplane", "plane", "travel", "flight"] },
      { emoji: "\u{1F6EB}", keywords: ["departure", "airplane", "takeoff"] },
      { emoji: "\u{1F6EC}", keywords: ["arrival", "airplane", "landing"] },
      { emoji: "\u{1F681}", keywords: ["helicopter", "fly"] },
      { emoji: "\u{1F680}", keywords: ["rocket", "launch", "space", "startup", "fast"] },
      { emoji: "\u{1F6F8}", keywords: ["ufo", "flying saucer", "alien", "space"] },
      { emoji: "\u{1F697}", keywords: ["car", "automobile", "drive"] },
      { emoji: "\u{1F695}", keywords: ["taxi", "cab", "yellow"] },
      { emoji: "\u{1F699}", keywords: ["suv", "car", "vehicle"] },
      { emoji: "\u{1F68C}", keywords: ["bus", "public transport"] },
      { emoji: "\u{1F3CE}\u{FE0F}", keywords: ["racing car", "formula", "fast", "speed"] },
      { emoji: "\u{1F6B2}", keywords: ["bicycle", "bike", "cycling", "exercise"] },
      { emoji: "\u{1F6F4}", keywords: ["scooter", "kick scooter"] },
      { emoji: "\u{1F6B6}", keywords: ["walking", "pedestrian", "stroll"] },
      { emoji: "\u{1F3C3}", keywords: ["running", "runner", "exercise", "sprint"] },
      { emoji: "\u{1F307}", keywords: ["sunset", "city", "evening"] },
      { emoji: "\u{1F303}", keywords: ["night", "stars", "city"] },
      { emoji: "\u{1F309}", keywords: ["bridge", "night", "city"] },
      { emoji: "\u{1F301}", keywords: ["foggy", "bridge", "weather"] },
      { emoji: "\u{1F320}", keywords: ["shooting star", "wish", "meteor"] },
      { emoji: "\u{1F387}", keywords: ["sparkler", "fireworks", "celebration"] },
      { emoji: "\u{1F386}", keywords: ["fireworks", "celebration", "new year"] },
      { emoji: "\u{1F9ED}", keywords: ["compass", "navigation", "direction"] },
    ],
  },
  {
    id: "objects",
    label: "Objects",
    icon: IconStar,
    emojis: [
      { emoji: "\u{1F4F1}", keywords: ["phone", "mobile", "smartphone", "iphone"] },
      { emoji: "\u{1F4BB}", keywords: ["laptop", "computer", "macbook", "work"] },
      { emoji: "\u{1F5A5}\u{FE0F}", keywords: ["desktop", "computer", "monitor", "screen"] },
      { emoji: "\u{2328}\u{FE0F}", keywords: ["keyboard", "typing", "computer"] },
      { emoji: "\u{1F5B1}\u{FE0F}", keywords: ["mouse", "computer", "click"] },
      { emoji: "\u{1F4BD}", keywords: ["disk", "computer", "storage"] },
      { emoji: "\u{1F4BE}", keywords: ["floppy disk", "save", "retro"] },
      { emoji: "\u{1F4F7}", keywords: ["camera", "photo", "photography"] },
      { emoji: "\u{1F4F8}", keywords: ["camera flash", "photo", "selfie"] },
      { emoji: "\u{1F4F9}", keywords: ["video camera", "film", "record"] },
      { emoji: "\u{1F3AC}", keywords: ["clapper board", "movie", "film", "action"] },
      { emoji: "\u{1F4FA}", keywords: ["tv", "television", "screen"] },
      { emoji: "\u{1F4FB}", keywords: ["radio", "broadcast", "music"] },
      { emoji: "\u{1F50B}", keywords: ["battery", "power", "energy", "charge"] },
      { emoji: "\u{1F50C}", keywords: ["plug", "electric", "power"] },
      { emoji: "\u{1F4A1}", keywords: ["light bulb", "idea", "innovation", "bright"] },
      { emoji: "\u{1F526}", keywords: ["flashlight", "torch", "light"] },
      { emoji: "\u{1F56F}\u{FE0F}", keywords: ["candle", "light", "romantic"] },
      { emoji: "\u{1F4B0}", keywords: ["money bag", "rich", "dollar", "cash", "wealth"] },
      { emoji: "\u{1F4B5}", keywords: ["dollar", "money", "cash", "bill"] },
      { emoji: "\u{1F4B4}", keywords: ["yen", "money", "japanese"] },
      { emoji: "\u{1F4B6}", keywords: ["euro", "money", "european"] },
      { emoji: "\u{1F4B3}", keywords: ["credit card", "payment", "bank"] },
      { emoji: "\u{1F4B8}", keywords: ["money", "wings", "flying", "spend", "expensive"] },
      { emoji: "\u{1F4E7}", keywords: ["email", "mail", "letter", "message"] },
      { emoji: "\u{1F4E8}", keywords: ["incoming", "envelope", "mail", "receive"] },
      { emoji: "\u{1F4E9}", keywords: ["envelope", "arrow", "send"] },
      { emoji: "\u{1F4EC}", keywords: ["mailbox", "mail", "letter"] },
      { emoji: "\u{1F4DD}", keywords: ["memo", "note", "write", "pencil", "document"] },
      { emoji: "\u{1F4D3}", keywords: ["notebook", "journal", "notes"] },
      { emoji: "\u{1F4D5}", keywords: ["book", "closed", "read"] },
      { emoji: "\u{1F4D6}", keywords: ["book", "open", "read", "study"] },
      { emoji: "\u{1F4DA}", keywords: ["books", "library", "study", "read"] },
      { emoji: "\u{1F4CB}", keywords: ["clipboard", "list", "todo", "checklist"] },
      { emoji: "\u{1F4CC}", keywords: ["pushpin", "pin", "location"] },
      { emoji: "\u{1F4CE}", keywords: ["paperclip", "attachment"] },
      { emoji: "\u{1F4CF}", keywords: ["ruler", "straight", "measure"] },
      { emoji: "\u{1F4D0}", keywords: ["ruler", "triangle", "measure"] },
      { emoji: "\u{2702}\u{FE0F}", keywords: ["scissors", "cut"] },
      { emoji: "\u{1F4E6}", keywords: ["package", "box", "delivery", "shipping"] },
      { emoji: "\u{1F511}", keywords: ["key", "lock", "security", "password"] },
      { emoji: "\u{1F512}", keywords: ["lock", "security", "locked", "secure"] },
      { emoji: "\u{1F513}", keywords: ["unlock", "unlocked", "open"] },
      { emoji: "\u{1F50D}", keywords: ["search", "magnifying glass", "zoom", "find"] },
      { emoji: "\u{1F50E}", keywords: ["magnifying glass", "right", "search"] },
      { emoji: "\u{1F52C}", keywords: ["microscope", "science", "research"] },
      { emoji: "\u{1F52D}", keywords: ["telescope", "stars", "space", "astronomy"] },
      { emoji: "\u{2699}\u{FE0F}", keywords: ["gear", "settings", "cog", "tool"] },
      { emoji: "\u{1F527}", keywords: ["wrench", "tool", "fix", "settings"] },
      { emoji: "\u{1F528}", keywords: ["hammer", "tool", "build"] },
      { emoji: "\u{1F6E0}\u{FE0F}", keywords: ["hammer", "wrench", "tools", "build"] },
      { emoji: "\u{2696}\u{FE0F}", keywords: ["balance", "scale", "justice", "law"] },
      { emoji: "\u{1F517}", keywords: ["link", "chain", "url", "connection"] },
      { emoji: "\u{26D3}\u{FE0F}", keywords: ["chains", "links", "connected"] },
      { emoji: "\u{1F4F0}", keywords: ["newspaper", "news", "media", "press"] },
      { emoji: "\u{1F3F7}\u{FE0F}", keywords: ["label", "tag", "price"] },
      { emoji: "\u{23F0}", keywords: ["alarm", "clock", "time", "wake up", "morning"] },
      { emoji: "\u{23F3}", keywords: ["hourglass", "time", "flowing", "waiting"] },
      { emoji: "\u{1F570}\u{FE0F}", keywords: ["clock", "mantelpiece", "time"] },
    ],
  },
  {
    id: "symbols",
    label: "Symbols",
    icon: IconBriefcase,
    emojis: [
      { emoji: "\u{2764}\u{FE0F}", keywords: ["heart", "red", "love", "like"] },
      { emoji: "\u{1F9E1}", keywords: ["heart", "orange", "love"] },
      { emoji: "\u{1F49B}", keywords: ["heart", "yellow", "love"] },
      { emoji: "\u{1F49A}", keywords: ["heart", "green", "love"] },
      { emoji: "\u{1F499}", keywords: ["heart", "blue", "love"] },
      { emoji: "\u{1F49C}", keywords: ["heart", "purple", "love"] },
      { emoji: "\u{1F5A4}", keywords: ["heart", "black", "love", "dark"] },
      { emoji: "\u{1F90D}", keywords: ["heart", "white", "love"] },
      { emoji: "\u{1F90E}", keywords: ["heart", "brown", "love"] },
      { emoji: "\u{1F494}", keywords: ["broken heart", "sad", "heartbreak"] },
      { emoji: "\u{2763}\u{FE0F}", keywords: ["heart exclamation", "love"] },
      { emoji: "\u{1F495}", keywords: ["two hearts", "love", "couple"] },
      { emoji: "\u{1F496}", keywords: ["sparkling heart", "love", "shine"] },
      { emoji: "\u{1F497}", keywords: ["growing heart", "love"] },
      { emoji: "\u{1F498}", keywords: ["heart arrow", "love", "cupid"] },
      { emoji: "\u{1F49D}", keywords: ["heart ribbon", "gift", "love"] },
      { emoji: "\u{1F49E}", keywords: ["revolving hearts", "love"] },
      { emoji: "\u{1F49F}", keywords: ["heart decoration", "love"] },
      { emoji: "\u{2728}", keywords: ["sparkles", "magic", "new", "shine", "clean"] },
      { emoji: "\u{2B50}", keywords: ["star", "gold", "favorite", "rating"] },
      { emoji: "\u{1F31F}", keywords: ["glowing star", "bright", "shine"] },
      { emoji: "\u{1F4AB}", keywords: ["dizzy", "star", "sparkle"] },
      { emoji: "\u{1F4AF}", keywords: ["100", "hundred", "perfect", "score"] },
      { emoji: "\u{2705}", keywords: ["check", "green", "yes", "done", "complete", "correct"] },
      { emoji: "\u{274C}", keywords: ["cross", "x", "red", "no", "wrong", "delete"] },
      { emoji: "\u{274E}", keywords: ["cross mark", "x", "no"] },
      { emoji: "\u{2757}", keywords: ["exclamation", "warning", "important", "alert"] },
      { emoji: "\u{2753}", keywords: ["question", "mark", "help", "confused"] },
      { emoji: "\u{2754}", keywords: ["question", "white", "help"] },
      { emoji: "\u{2755}", keywords: ["exclamation", "white", "important"] },
      { emoji: "\u{203C}\u{FE0F}", keywords: ["double exclamation", "bangbang", "important"] },
      { emoji: "\u{2049}\u{FE0F}", keywords: ["exclamation question", "interrobang"] },
      { emoji: "\u{1F4A4}", keywords: ["zzz", "sleep", "tired", "rest"] },
      { emoji: "\u{267B}\u{FE0F}", keywords: ["recycle", "green", "environment", "sustainability"] },
      { emoji: "\u{269B}\u{FE0F}", keywords: ["atom", "science", "physics", "nuclear"] },
      { emoji: "\u{1F549}\u{FE0F}", keywords: ["om", "hinduism", "buddhism", "religion"] },
      { emoji: "\u{2622}\u{FE0F}", keywords: ["radioactive", "nuclear", "danger"] },
      { emoji: "\u{2623}\u{FE0F}", keywords: ["biohazard", "danger", "toxic"] },
      { emoji: "\u{26A0}\u{FE0F}", keywords: ["warning", "caution", "alert", "danger"] },
      { emoji: "\u{1F6AB}", keywords: ["prohibited", "no", "forbidden", "stop"] },
      { emoji: "\u{2795}", keywords: ["plus", "add", "more"] },
      { emoji: "\u{2796}", keywords: ["minus", "subtract", "less"] },
      { emoji: "\u{2716}\u{FE0F}", keywords: ["multiply", "x", "times"] },
      { emoji: "\u{27A1}\u{FE0F}", keywords: ["arrow", "right", "next", "forward"] },
      { emoji: "\u{2B05}\u{FE0F}", keywords: ["arrow", "left", "back", "previous"] },
      { emoji: "\u{2B06}\u{FE0F}", keywords: ["arrow", "up", "increase"] },
      { emoji: "\u{2B07}\u{FE0F}", keywords: ["arrow", "down", "decrease"] },
      { emoji: "\u{21A9}\u{FE0F}", keywords: ["return", "arrow", "back", "undo"] },
      { emoji: "\u{1F504}", keywords: ["arrows", "counterclockwise", "refresh", "reload"] },
      { emoji: "\u{1F503}", keywords: ["arrows", "clockwise", "refresh"] },
      { emoji: "\u{1F519}", keywords: ["back", "arrow", "return"] },
      { emoji: "\u{1F51D}", keywords: ["top", "arrow", "up"] },
      { emoji: "\u{1F51A}", keywords: ["end", "arrow"] },
      { emoji: "\u{0030}\u{FE0F}\u{20E3}", keywords: ["zero", "0", "number"] },
      { emoji: "\u{0031}\u{FE0F}\u{20E3}", keywords: ["one", "1", "number"] },
      { emoji: "\u{0032}\u{FE0F}\u{20E3}", keywords: ["two", "2", "number"] },
      { emoji: "\u{0033}\u{FE0F}\u{20E3}", keywords: ["three", "3", "number"] },
      { emoji: "\u{0034}\u{FE0F}\u{20E3}", keywords: ["four", "4", "number"] },
      { emoji: "\u{0035}\u{FE0F}\u{20E3}", keywords: ["five", "5", "number"] },
      { emoji: "\u{0036}\u{FE0F}\u{20E3}", keywords: ["six", "6", "number"] },
      { emoji: "\u{0037}\u{FE0F}\u{20E3}", keywords: ["seven", "7", "number"] },
      { emoji: "\u{0038}\u{FE0F}\u{20E3}", keywords: ["eight", "8", "number"] },
      { emoji: "\u{0039}\u{FE0F}\u{20E3}", keywords: ["nine", "9", "number"] },
      { emoji: "\u{1F51F}", keywords: ["ten", "10", "number"] },
      { emoji: "\u{1F520}", keywords: ["abcd", "uppercase", "letters"] },
      { emoji: "\u{1F521}", keywords: ["abcd", "lowercase", "letters"] },
      { emoji: "\u{2139}\u{FE0F}", keywords: ["information", "info", "source"] },
      { emoji: "\u{1F195}", keywords: ["new", "fresh", "badge"] },
      { emoji: "\u{1F199}", keywords: ["up", "update", "badge"] },
      { emoji: "\u{1F197}", keywords: ["ok", "badge", "approve"] },
      { emoji: "\u{1F192}", keywords: ["cool", "badge"] },
      { emoji: "\u{1F198}", keywords: ["sos", "help", "emergency"] },
      { emoji: "\u{26AA}", keywords: ["white circle", "dot"] },
      { emoji: "\u{26AB}", keywords: ["black circle", "dot"] },
      { emoji: "\u{1F534}", keywords: ["red circle", "dot", "stop"] },
      { emoji: "\u{1F535}", keywords: ["blue circle", "dot"] },
      { emoji: "\u{1F7E0}", keywords: ["orange circle", "dot"] },
      { emoji: "\u{1F7E1}", keywords: ["yellow circle", "dot"] },
      { emoji: "\u{1F7E2}", keywords: ["green circle", "dot", "go"] },
      { emoji: "\u{1F7E3}", keywords: ["purple circle", "dot"] },
    ],
  },
  {
    id: "flags",
    label: "Flags",
    icon: IconFlag,
    emojis: [
      { emoji: "\u{1F3C1}", keywords: ["checkered flag", "race", "finish", "winner"] },
      { emoji: "\u{1F6A9}", keywords: ["triangular flag", "pennant"] },
      { emoji: "\u{1F3F4}", keywords: ["black flag", "pirate"] },
      { emoji: "\u{1F3F3}\u{FE0F}", keywords: ["white flag", "surrender", "peace"] },
      { emoji: "\u{1F3F3}\u{FE0F}\u{200D}\u{1F308}", keywords: ["rainbow flag", "pride", "lgbtq"] },
      { emoji: "\u{1F1FA}\u{1F1F8}", keywords: ["us", "usa", "america", "united states", "flag"] },
      { emoji: "\u{1F1EC}\u{1F1E7}", keywords: ["gb", "uk", "britain", "england", "flag"] },
      { emoji: "\u{1F1E8}\u{1F1E6}", keywords: ["canada", "flag"] },
      { emoji: "\u{1F1E6}\u{1F1FA}", keywords: ["australia", "flag"] },
      { emoji: "\u{1F1EE}\u{1F1F3}", keywords: ["india", "flag"] },
      { emoji: "\u{1F1E9}\u{1F1EA}", keywords: ["germany", "flag"] },
      { emoji: "\u{1F1EB}\u{1F1F7}", keywords: ["france", "flag"] },
      { emoji: "\u{1F1EA}\u{1F1F8}", keywords: ["spain", "flag"] },
      { emoji: "\u{1F1EE}\u{1F1F9}", keywords: ["italy", "flag"] },
      { emoji: "\u{1F1E7}\u{1F1F7}", keywords: ["brazil", "flag"] },
      { emoji: "\u{1F1EF}\u{1F1F5}", keywords: ["japan", "flag"] },
      { emoji: "\u{1F1F0}\u{1F1F7}", keywords: ["korea", "south korea", "flag"] },
      { emoji: "\u{1F1E8}\u{1F1F3}", keywords: ["china", "flag"] },
      { emoji: "\u{1F1F7}\u{1F1FA}", keywords: ["russia", "flag"] },
      { emoji: "\u{1F1F2}\u{1F1FD}", keywords: ["mexico", "flag"] },
      { emoji: "\u{1F1E6}\u{1F1EA}", keywords: ["uae", "emirates", "flag"] },
      { emoji: "\u{1F1F8}\u{1F1E6}", keywords: ["saudi arabia", "flag"] },
      { emoji: "\u{1F1F3}\u{1F1EC}", keywords: ["nigeria", "flag"] },
      { emoji: "\u{1F1FF}\u{1F1E6}", keywords: ["south africa", "flag"] },
      { emoji: "\u{1F1F8}\u{1F1EC}", keywords: ["singapore", "flag"] },
      { emoji: "\u{1F1EE}\u{1F1EA}", keywords: ["ireland", "flag"] },
      { emoji: "\u{1F1F3}\u{1F1F1}", keywords: ["netherlands", "flag"] },
      { emoji: "\u{1F1F8}\u{1F1EA}", keywords: ["sweden", "flag"] },
      { emoji: "\u{1F1E8}\u{1F1ED}", keywords: ["switzerland", "flag"] },
      { emoji: "\u{1F1F5}\u{1F1F1}", keywords: ["poland", "flag"] },
    ],
  },
]

/** Maximum number of recently used emojis to store */
const MAX_RECENT_EMOJIS = 12

/** LocalStorage key for recently used emojis */
const RECENT_EMOJIS_KEY = "chainlinked-recent-emojis"

/**
 * Hook to manage recently used emojis with localStorage persistence.
 */
function useRecentEmojis() {
  const [recentEmojis, setRecentEmojis] = React.useState<string[]>([])

  // Load recent emojis from localStorage on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_EMOJIS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setRecentEmojis(parsed.slice(0, MAX_RECENT_EMOJIS))
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  /**
   * Adds an emoji to the recent list.
   * @param emoji - The emoji to add
   */
  const addRecentEmoji = React.useCallback((emoji: string) => {
    setRecentEmojis((prev) => {
      const filtered = prev.filter((e) => e !== emoji)
      const updated = [emoji, ...filtered].slice(0, MAX_RECENT_EMOJIS)
      try {
        localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated))
      } catch {
        // Ignore localStorage errors
      }
      return updated
    })
  }, [])

  return { recentEmojis, addRecentEmoji }
}

/**
 * EmojiPicker provides a custom popover-based emoji selector with categories,
 * keyword-based search functionality, and recently used emojis.
 * Matches LinkedIn's emoji palette with comprehensive emoji coverage.
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false)
 *
 * <EmojiPicker
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSelect={(emoji) => {
 *     console.log("Selected:", emoji)
 *     setIsOpen(false)
 *   }}
 * >
 *   <Button onClick={() => setIsOpen(!isOpen)}>
 *     <IconMoodSmile /> Emoji
 *   </Button>
 * </EmojiPicker>
 * ```
 */
export function EmojiPicker({
  onSelect,
  isOpen,
  onClose,
  onOpenChange,
  className,
  children,
}: EmojiPickerProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [activeCategory, setActiveCategory] = React.useState("smileys")
  const [focusedIndex, setFocusedIndex] = React.useState(-1)
  const { recentEmojis, addRecentEmoji } = useRecentEmojis()
  const gridRef = React.useRef<HTMLDivElement>(null)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  /**
   * Resets state when popover opens/closes.
   */
  React.useEffect(() => {
    if (isOpen) {
      setSearchQuery("")
      setFocusedIndex(-1)
      // Focus search input when opened
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 0)
    }
  }, [isOpen])

  /**
   * Filters emojis based on keyword search.
   * Searches through each emoji's keywords for matches.
   */
  const filteredEmojis = React.useMemo(() => {
    if (!searchQuery.trim()) return null

    const query = searchQuery.toLowerCase().trim()
    const results: string[] = []

    EMOJI_CATEGORIES.forEach((category) => {
      category.emojis.forEach((entry) => {
        if (entry.keywords.some((kw) => kw.includes(query))) {
          results.push(entry.emoji)
        }
      })
    })

    return results.slice(0, 60)
  }, [searchQuery])

  /**
   * Gets the current category's emojis.
   */
  const currentCategoryEmojis = React.useMemo(() => {
    const category = EMOJI_CATEGORIES.find((c) => c.id === activeCategory)
    return category?.emojis.map((e) => e.emoji) ?? []
  }, [activeCategory])

  /**
   * The emojis to display in the grid.
   */
  const displayEmojis = filteredEmojis ?? currentCategoryEmojis

  /**
   * Handles emoji selection.
   */
  const handleSelectEmoji = React.useCallback(
    (emoji: string) => {
      addRecentEmoji(emoji)
      onSelect(emoji)
      onClose()
    },
    [addRecentEmoji, onSelect, onClose]
  )

  /**
   * Handles keyboard navigation.
   */
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      const columns = 8
      const total = displayEmojis.length

      switch (event.key) {
        case "ArrowRight":
          event.preventDefault()
          setFocusedIndex((prev) => (prev + 1) % total)
          break
        case "ArrowLeft":
          event.preventDefault()
          setFocusedIndex((prev) => (prev - 1 + total) % total)
          break
        case "ArrowDown":
          event.preventDefault()
          setFocusedIndex((prev) => Math.min(prev + columns, total - 1))
          break
        case "ArrowUp":
          event.preventDefault()
          setFocusedIndex((prev) => Math.max(prev - columns, 0))
          break
        case "Enter":
        case " ":
          event.preventDefault()
          if (focusedIndex >= 0 && focusedIndex < displayEmojis.length) {
            handleSelectEmoji(displayEmojis[focusedIndex])
          }
          break
        case "Escape":
          event.preventDefault()
          onClose()
          break
      }
    },
    [displayEmojis, focusedIndex, handleSelectEmoji, onClose]
  )

  /**
   * Handles popover open state change.
   */
  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (onOpenChange) {
        onOpenChange(open)
      }
      if (!open) {
        onClose()
      }
    },
    [onClose, onOpenChange]
  )

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className={cn("w-96 p-0", className)}
        align="start"
        sideOffset={8}
        onKeyDown={handleKeyDown}
      >
        <div className="flex flex-col">
          {/* Search Header */}
          <div className="p-3 border-b">
            <div className="relative">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="search"
                placeholder="Search emojis... (e.g. smile, heart, fire)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-6"
                  onClick={() => setSearchQuery("")}
                >
                  <IconX className="size-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Category Tabs */}
          {!searchQuery && (
            <Tabs
              value={activeCategory}
              onValueChange={setActiveCategory}
              className="w-full"
            >
              <div className="border-b overflow-x-auto">
                <TabsList className="h-10 w-full justify-start rounded-none bg-transparent p-0 px-1">
                  {EMOJI_CATEGORIES.map((category) => {
                    const Icon = category.icon
                    return (
                      <TabsTrigger
                        key={category.id}
                        value={category.id}
                        className="h-9 px-2 data-[state=active]:bg-muted rounded-md"
                        title={category.label}
                      >
                        <Icon className="size-4" />
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </div>
            </Tabs>
          )}

          {/* Recently Used Section */}
          {!searchQuery && recentEmojis.length > 0 && (
            <div className="p-2 border-b">
              <div className="flex items-center gap-1.5 mb-1.5">
                <IconClock className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Recently Used
                </span>
              </div>
              <div className="grid grid-cols-8 gap-0.5">
                {recentEmojis.map((emoji, index) => (
                  <button
                    key={`recent-${index}`}
                    type="button"
                    onClick={() => handleSelectEmoji(emoji)}
                    className={cn(
                      "flex items-center justify-center size-8 rounded-md text-xl",
                      "hover:bg-muted transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                    )}
                    title="Recently used"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Emoji Grid */}
          <div
            ref={gridRef}
            className="p-2 h-[240px] overflow-y-auto"
            role="grid"
            aria-label="Emojis"
          >
            {searchQuery && (
              <div className="flex items-center gap-1.5 mb-1.5">
                <IconSearch className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Search Results ({displayEmojis.length})
                </span>
              </div>
            )}
            <div className="grid grid-cols-8 gap-0.5">
              {displayEmojis.map((emoji, index) => (
                <button
                  key={`${emoji}-${index}`}
                  type="button"
                  onClick={() => handleSelectEmoji(emoji)}
                  className={cn(
                    "flex items-center justify-center size-8 rounded-md text-xl",
                    "hover:bg-muted transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                    focusedIndex === index && "bg-muted ring-2 ring-ring"
                  )}
                  tabIndex={focusedIndex === index ? 0 : -1}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {displayEmojis.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <IconMoodSmile className="size-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No emojis found</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
              </div>
            )}
          </div>

          {/* Category Label Footer */}
          {!searchQuery && (
            <div className="px-3 py-2 border-t bg-muted/30">
              <span className="text-xs text-muted-foreground">
                {EMOJI_CATEGORIES.find((c) => c.id === activeCategory)?.label}
              </span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
