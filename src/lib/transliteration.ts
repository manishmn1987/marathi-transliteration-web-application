/**
 * Marathi Roman -> Devanagari transliteration engine
 * Custom rule-based engine (MIT licensed, no paid API, fully offline).
 * Inspired by Google Input Tools / Dakshina transliteration principles.
 * - Dictionary overrides for common Marathi words (highest accuracy)
 * - Morphological stem + oblique form (सामान्यरूप) + postposition analyzer
 * - Personal user dictionary (persisted in localStorage)
 * - Phonetic syllable parser for unknown words
 * - Candidate generation for ambiguous spellings (ळ / ल, ण / न, ड / द, anusvara)
 */

import { EXTRA_DICT_ENTRIES, MARATHI_SUFFIX_RULES } from "./marathiData";

export const ENGLISH_WORDS = new Set([
  "the","are","was","were","been","being","and","but","then","else",
  "you","she","they","him","her","them","your","his","its","our","their",
  "this","that","these","those","what","which","who","whom","whose","when","where","why","how",
  "for","of","with","from","into","through","after","over","between","out","against","during","without","before","under","around","among",
  "not","yes","does","did","have","has","had","will","would","can","could","shall","should","may","might","must",
  "hello","hi","hey","please","thank","thanks","sorry","welcome","good","morning","afternoon","evening","night",
  "today","tomorrow","yesterday","now","here","there","very","much","many","more","most","some","any","all","each","every","both","few","other","same","such","only","own","also","just","than","too",
  "one","two","three","four","five","six","seven","eight","nine","first","second","third",
  "people","time","year","way","day","thing","world","life","hand","child","eye","woman","place","work","week","case","point","government","company","number","group","problem","fact",
  "come","know","take","get","make","find","tell","try","leave","feel","put","mean","keep","let","begin","seem","help","talk","turn","start","show","hear","play","move","live","believe","hold","bring","happen","write","sit","stand","lose","pay","meet","include","continue","learn","change","lead","understand","watch","follow","stop","create","speak","read","allow","add","spend","grow","open","walk","win","offer","remember","love","consider","appear","buy","wait","serve","die","send","expect","build","stay","reach","kill","remain","suggest","raise","sell","require","report","decide","pull",
  "new","last","long","great","little","old","right","big","high","different","small","large","next","early","young","important","public","bad","able","local","sure","clear","full","special","easy","strong","possible","whole","free","true","real","certain","personal","recent","ready","available","common","similar","private","past","necessary","known","various","down","force","blue","objective","economy","investment","response","version","asset",
  "computer","laptop","internet","email","website","online","mobile","phone","keyboard","mouse","screen","window","file","folder","download","upload","copy","paste","print","save","close","search","google","youtube","facebook","whatsapp","instagram","twitter","english","hindi","language","typing","text","word","sentence","paragraph","document","pdf","txt","export","import","settings","help","about","home","editor","preview","candidate","suggestion","convert","translation","transliteration",
  "ok","okay","wow","cool","nice","fine","well","wrong","maybe","really","actually","basically","literally","probably","definitely","absolutely","totally","completely","almost","quite","rather","pretty","fairly","extremely","incredibly","amazing","wonderful","fantastic","excellent","perfect","awesome","brilliant","terrible","horrible","awful","lovely","beautiful","gorgeous","stunning","handsome","ugly","attractive","charming","delightful","pleasant","superb","marvelous","magnificent","splendid","glorious","grand","impressive","striking","breathtaking","spectacular","sensational","phenomenal","extraordinary","remarkable","outstanding","exceptional","incredible","unbelievable","astounding","astonishing","shocking","surprising","unexpected","unusual","strange","odd","weird","bizarre","peculiar","curious","funny","hilarious","amusing","entertaining","interesting","fascinating","engaging","captivating","compelling","intriguing","absorbing","riveting","gripping","thrilling","exciting","electrifying","exhilarating","stimulating","inspiring","motivating","uplifting","encouraging","heartwarming","touching","moving","emotional","sentimental","nostalgic","poignant","bittersweet","melancholy","somber","gloomy","bleak","dreary","dismal","miserable","depressing","saddening","heartbreaking","devastating","traumatic","horrifying","terrifying","frightening","scary","spooky","eerie","creepy","sinister","ominous","foreboding","menacing","threatening","intimidating","daunting","formidable","imposing","majestic","stately","regal","royal","noble","dignified","elegant","graceful","refined","sophisticated","cultured","polished","classy","stylish","fashionable","trendy","chic","sleek","smart","sharp","crisp","clean","neat","tidy","orderly","organized","systematic","methodical","structured","coherent","logical","rational","sensible","practical","pragmatic","realistic","balanced","harmonious","peaceful","serene","tranquil","calm","relaxed","easygoing","carefree","independent","self-reliant","autonomous","sovereign","liberated","unrestricted","unlimited","boundless","infinite","endless","eternal","everlasting","perpetual","continuous","uninterrupted","ceaseless","relentless","incessant","constant","persistent","steadfast","unwavering","unshakable","unbreakable","indestructible","invincible","unbeatable","unconquerable","invulnerable","impenetrable","impervious","resistant","immune","protected","sheltered","shielded","guarded","defended","fortified","secured","safe","secure","sound","solid","sturdy","robust","powerful","mighty","potent","effective","efficacious","productive","fruitful","beneficial","advantageous","profitable","lucrative","rewarding","worthwhile","valuable","precious","priceless","invaluable","treasured","cherished","beloved","adored","loved","liked","favored","preferred","chosen","selected","elected","appointed","nominated","designated","assigned","allocated","allotted","granted","awarded","bestowed","conferred","presented","given","offered","extended","provided","supplied","furnished","equipped","outfitted","armed","prepared","primed","poised","set","fitted","provisioned","stocked","strengthened","reinforced","bolstered","buttressed","supported","backed","endorsed","sponsored","funded","financed","aided","assisted","helped","facilitated","enabled","empowered",
]);

const DICT_ENTRIES: [string, string[]][] = [
  ["namaskar", ["नमस्कार"]],
  ["swagat", ["स्वागत"]],
  ["abhinandan", ["अभिनंदन"]],
  ["mi", ["मी"]],
  ["aamhi", ["आम्ही"]],
  ["majha", ["माझा"]],
  ["majhaa", ["माझा"]],
  ["maza", ["माझा"]],
  ["mazaa", ["माझा"]],
  ["bharat", ["भारत"]],
  ["bhaarat", ["भारत"]],
  ["bharata", ["भारता"]],
  ["bhaarata", ["भारता"]],
  ["raja", ["राजा"]],
  ["raajaa", ["राजा"]],
  ["shivaji", ["शिवाजी"]],
  ["maharaj", ["महाराज"]],
  ["sambhaji", ["संभाजी"]],
  ["chhatrapati", ["छत्रपती"]],
  ["pustak", ["पुस्तक"]],
  ["shikshak", ["शिक्षक"]],
  ["vahi", ["वही"]],
  ["swatantrya", ["स्वातंत्र्य"]],
  ["krupaya", ["कृपया"]],
  ["shrimant", ["श्रीमंत"]],
  ["baba", ["बाबा"]],
  ["kaka", ["काका"]],
  ["mama", ["मामा"]],
  ["dada", ["दादा"]],
  ["taai", ["ताई"]],
  ["tujha", ["तुझा"]],
  ["tyacha", ["त्याचा"]],
  ["aamcha", ["आमचा"]],
  ["mala", ["मला"]],
  ["majhyala", ["माझ्याला"]],
  ["kon", ["कोण"]],
  ["ka", ["का"]],
  ["pratyek", ["प्रत्येक"]],
  ["ahe", ["आहे"]],
  ["asel", ["असेल"]],
  ["yete", ["येते"]],
  ["jato", ["जातो"]],
  ["karto", ["करतो"]],
  ["pahato", ["पाहतो"]],
  ["bolto", ["बोलतो"]],
  ["aikto", ["ऐकतो"]],
  ["lihto", ["लिहितो"]],
  ["vachto", ["वाचतो"]],
  ["deto", ["देतो"]],
  ["gheto", ["घेतो"]],
  ["sangto", ["सांगतो"]],
  ["samajto", ["समजतो"]],
  ["watto", ["वाटतो"]],
  ["lagto", ["लागतो"]],
  ["disato", ["दिसतो"]],
  ["bhetto", ["भेटतो"]],
  ["yeto", ["येतो"]],
  ["karaycha", ["करायचा"]],
  ["jaycha", ["जायचा"]],
  ["pahaycha", ["पाहायचा"]],
  ["bolaycha", ["बोलायचा"]],
  ["changla", ["चांगला"]],
  ["vait", ["वाईट"]],
  ["nava", ["नवा"]],
  ["sundar", ["सुंदर"]],
  ["khup", ["खूप"]],
  ["ata", ["आता"]],
  ["aaj", ["आज"]],
  ["sakali", ["सकाळी"]],
  ["ithe", ["इथे"]],
  ["sarva", ["सर्व"]],
  ["kahi", ["काही"]],
  ["nahi", ["नाही"]],
  ["ho", ["हो"]],
  ["marathi", ["मराठी"]],
  ["pune", ["पुणे"]],
  ["desh", ["देश"]],
  ["ghar", ["घर"]],
  ["shala", ["शाळा"]],
  ["college", ["कॉलेज"]],
  ["mandir", ["मंदिर"]],
  ["nadi", ["नदी"]],
  ["rasta", ["रस्ता"]],
  ["aai", ["आई"]],
  ["mitra", ["मित्र"]],
  ["manus", ["माणूस"]],
  ["guru", ["गुरु"]],
  ["doctor", ["डॉक्टर"]],
  ["vyapari", ["व्यापारी"]],
  ["pani", ["पाणी","पनी"]],
  ["sakal", ["सकाळ"]],
  ["surya", ["सूर्य"]],
  ["paus", ["पाऊस"]],
  ["phul", ["फूल"]],
  ["pakshi", ["पक्षी"]],
  ["manjar", ["मांजर"]],
  ["ek", ["एक"]],
  ["akra", ["अकरा"]],
  ["shambhar", ["शंभर"]],
  ["pahila", ["पहिला"]],
  ["karayche", ["करायचे"]],
  ["karayala", ["करायला"]],
  ["karun", ["करून"]],
  ["kela", ["केला"]],
  ["aala", ["आला"]],
  ["hota", ["होता"]],
  ["kase", ["कसे"]],
  ["tumhi", ["तुम्ही"]],
  ["aani", ["आणि"]],
  ["kala", ["कळा","कला"]],
  ["bala", ["बळा","बला"]],
  ["pala", ["पळा","पला"]],
  ["jala", ["जळा","जला"]],
  ["dhan", ["धन","धान"]],
  ["dene", ["देणे","देने"]],
  ["karne", ["करणे","कर्ने"]],
  ["tarne", ["तरणे","तर्ने"]],
  ["sarne", ["सरणे","सर्ने"]],
  ["bhasha", ["भाषा"]],
  ["sanskriti", ["संस्कृती"]],
  ["sahitya", ["साहित्य"]],
  ["geet", ["गीत"]],
  ["natak", ["नाटक"]],
  ["khel", ["खेळ"]],
  ["shikshan", ["शिक्षण"]],
  ["nokri", ["नोकरी"]],
  ["paise", ["पैसे"]],
  ["vel", ["वेळ"]],
  ["mahina", ["महिना"]],
  ["aathavada", ["आठवडा"]],
  ["dhanyavad", ["धन्यवाद"]],
  ["asa", ["असा"]],
  ["tasa", ["तसा"]],
  ["jasa", ["जसा"]],
  ["kasa", ["कसा"]],
  ["itka", ["इतका"]],
  ["titka", ["तितका"]],
  ["kiti", ["किती"]],
  ["hot", ["होत"]],
  ["prem", ["प्रेम"]],
  ["maitri", ["मैत्री"]],
  ["kutumb", ["कुटुंब"]],
  ["parivar", ["परिवार"]],
  ["samaj", ["समाज"]],
  ["rajya", ["राज्य"]],
  ["itihas", ["इतिहास"]],
  ["katha", ["कथा"]],
  ["kavita", ["कविता"]],
  ["divas", ["दिवस"]],
  ["varsha", ["वर्ष"]],
  ["lihaycha", ["लिहायचा"]],
  ["vachaycha", ["वाचायचा"]],
  ["gela", ["गेला"]],
  ["motha", ["मोठा"]],
  ["lahan", ["लहान"]],
  ["juna", ["जुना"]],
  ["bhau", ["भाऊ"]],
  ["vidyarthi", ["विद्यार्थी"]],
  ["vadapav", ["वडापाव"]],
  ["kuth", ["कुठे"]],
  ["doka", ["डोके"]],
  ["dol", ["डोळा"]],
  ["dukana", ["दुकान"]],
  ["gaadi", ["गाडी"]],
  ["viman", ["विमान"]],
  ["anand", ["आनंद"]],
  ["shanti", ["शांती"]],
  ["yash", ["यश"]],
  ["prayatna", ["प्रयत्न"]],
  ["vishwas", ["विश्वास"]],
  ["aasha", ["आशा"]],
  ["jar", ["जर"]],
  ["kivva", ["किंवा"]],
  ["mag", ["मग"]],
  ["aadhi", ["आधी"]],
  ["jevto", ["जेवतो"]],
  ["pitto", ["पितो"]],
  ["zopto", ["झोपतो"]],
  ["utho", ["उठतो"]],
  ["bastto", ["बसतो"]],
  ["ubhato", ["उभा राहतो"]],
  ["chalto", ["चालतो"]],
  ["palto", ["पळतो"]],
  ["khelto", ["खेळतो"]],
  ["gatto", ["गातो"]],
  ["nachto", ["नाचतो"]],
  ["hasto", ["हसतो"]],
  ["radto", ["रडतो"]],
  ["jevan", ["जेवण"]],
  ["dudh", ["दूध"]],
  ["bhat", ["भात"]],
  ["bhaji", ["भाजी"]],
  ["poli", ["पोळी"]],
  ["chapati", ["चपाती"]],
  ["chai", ["चहा"]],
  ["sandhya", ["संध्या"]],
  ["gava", ["गाव"]],
  ["shahar", ["शहर"]],
  ["dongar", ["डोंगर"]],
  ["samudra", ["समुद्र"]],
  ["kinara", ["किनारा"]],
  ["pul", ["पूल"]],
  ["maza", ["माझा"]],
  ["mulga", ["मुलगा"]],
  ["saha", ["सहा"]],
  ["wala", ["वळा","वला"]],
  ["marne", ["मरणे","मर्ने"]],
  ["karan", ["कारण"]],
  ["mahiti", ["माहिती"]],
  ["prashna", ["प्रश्न"]],
  ["uttar", ["उत्तर"]],
  ["vichar", ["विचार"]],
  ["bhavna", ["भावना"]],
  ["anubhav", ["अनुभव"]],
  ["sanskar", ["संस्कार"]],
  ["parampara", ["परंपरा"]],
  ["utsav", ["उत्सव"]],
  ["divali", ["दिवाळी"]],
  ["dasra", ["दसरा"]],
  ["rakhi", ["राखी"]],
  ["samor", ["समोर"]],
  ["station", ["स्टेशन"]],
  ["dole", ["डोळे"]],
  ["kal", ["कळ","काल"]],
  ["san", ["सण"]],
  ["ganpati", ["गणपती"]],
  ["holi", ["होळी"]],
  ["namaste", ['नमस्ते']],
  ["dhanyavaad", ['धन्यवाद']],
  ["swagata", ['स्वागत']],
  ["suprabhat", ['सुप्रभात']],
  ["shubh", ['शुभ']],
  ["shubhechha", ['शुभेच्छा']],
  ["naman", ['नमन']],
  ["vandan", ['वंदन']],
  ["pranam", ['प्रणाम']],
  ["tu", ['तू']],
  ["to", ['तो']],
  ["ti", ['ती']],
  ["te", ['ते']],
  ["he", ['हे']],
  ["hi", ['ही']],
  ["ha", ['हा']],
  ["tumche", ['तुमचे']],
  ["tumcha", ['तुमचा']],
  ["tumchi", ['तुमची']],
  ["majhi", ['माझी']],
  ["mazi", ['माझी']],
  ["majhe", ['माझे']],
  ["maze", ['माझे']],
  ["tujhi", ['तुझी']],
  ["tuzi", ['तुझी']],
  ["tujhe", ['तुझे']],
  ["tuze", ['तुझे']],
  ["tyachi", ['त्याची']],
  ["tyache", ['त्याचे']],
  ["ticha", ['तिचा']],
  ["tichi", ['तिची']],
  ["tiche", ['तिचे']],
  ["aamchi", ['आमची']],
  ["aamche", ['आमचे']],
  ["tula", ['तुला']],
  ["tyala", ['त्याला']],
  ["tichya", ['तिच्या']],
  ["tyachya", ['त्याच्या']],
  ["aamhala", ['आम्हाला']],
  ["tumhala", ['तुम्हाला']],
  ["majhyasathi", ['माझ्यासाठी']],
  ["kay", ['काय']],
  ["kuthhe", ['कुठे']],
  ["kadhi", ['कधी']],
  ["kashi", ['कशी']],
  ["kahich", ['काहीच']],
  ["sagle", ['सगळे']],
  ["sagala", ['सगळा']],
  ["sagli", ['सगळी']],
  ["aahe", ['आहे']],
  ["aahot", ['आहोत']],
  ["aahet", ['आहेत']],
  ["ahet", ['आहेत']],
  ["hote", ['होते']],
  ["hoto", ['होतो']],
  ["hotat", ['होतात']],
  ["hotoy", ['होतोय']],
  ["hotey", ['होतेय']],
  ["yeta", ['येता']],
  ["yetat", ['येतात']],
  ["yetoy", ['येतोय']],
  ["yetey", ['येतेय']],
  ["yeil", ['येईल']],
  ["yein", ['येईन']],
  ["jate", ['जाते']],
  ["jata", ['जाता']],
  ["jatat", ['जातात']],
  ["jail", ['जाईल']],
  ["jain", ['जाईन']],
  ["karta", ['करता']],
  ["kartat", ['करतात']],
  ["karel", ['करेल']],
  ["karen", ['करें']],
  ["kara", ['करा']],
  ["kar", ['कर']],
  ["pahate", ['पाहते']],
  ["pahata", ['पाहता']],
  ["pahatat", ['पाहतात']],
  ["paha", ['पाहा']],
  ["pah", ['पाह']],
  ["bolta", ['बोलता']],
  ["bolatat", ['बोलतात']],
  ["bola", ['बोला']],
  ["bol", ['बोल']],
  ["aikta", ['ऐकता']],
  ["aikatat", ['ऐकतात']],
  ["aika", ['ऐका']],
  ["aik", ['ऐक']],
  ["lihte", ['लिहिते']],
  ["lihtat", ['लिहितात']],
  ["liha", ['लिहा']],
  ["lih", ['लिह']],
  ["vachte", ['वाचते']],
  ["vachtat", ['वाचतात']],
  ["vacha", ['वाचा']],
  ["vach", ['वाच']],
  ["detat", ['देतात']],
  ["de", ['दे']],
  ["deta", ['देता']],
  ["ghetat", ['घेतात']],
  ["ghe", ['घे']],
  ["gheta", ['घेता']],
  ["sangtat", ['सांगतात']],
  ["sanga", ['सांगा']],
  ["sang", ['सांग']],
  ["samajtat", ['समजतात']],
  ["wat", ['वाट']],
  ["lagtat", ['लागतात']],
  ["lag", ['लाग']],
  ["disatat", ['दिसतात']],
  ["disa", ['दिसा']],
  ["dis", ['दिस']],
  ["bhetatat", ['भेटतात']],
  ["bheto", ['भेटू']],
  ["bhetalo", ['भेटलो']],
  ["karaychi", ['करायची']],
  ["jaychi", ['जायची']],
  ["jayche", ['जायचे']],
  ["jayala", ['जायला']],
  ["pahayala", ['पाहायला']],
  ["bolayala", ['बोलायला']],
  ["changli", ['चांगली']],
  ["changle", ['चांगले']],
  ["changlya", ['चांगल्या']],
  ["mothi", ['मोठी']],
  ["mothe", ['मोठे']],
  ["chhota", ['छोटा']],
  ["chhoti", ['छोटी']],
  ["navi", ['नवी']],
  ["nave", ['नवे']],
  ["juni", ['जुनी']],
  ["june", ['जुने']],
  ["sundara", ['सुंदर']],
  ["sundari", ['सुंदरी']],
  ["khupach", ['खूपच']],
  ["khupsa", ['खूपसा']],
  ["barach", ['बराच']],
  ["barich", ['बरीच']],
  ["barobar", ['बरोबर']],
  ["aata", ['आता']],
  ["aadi", ['आधी']],
  ["magh", ['मग']],
  ["parshva", ['परवा']],
  ["dupari", ['दुपारी']],
  ["sandhyakali", ['संध्याकाळी']],
  ["var", ['वर']],
  ["khali", ['खाली']],
  ["mage", ['मागे']],
  ["bajula", ['बाजूला']],
  ["thoda", ['थोडा']],
  ["thodi", ['थोडी']],
  ["thode", ['थोडे']],
  ["thodya", ['थोड्या']],
  ["saglya", ['सगळ्या']],
  ["nakos", ['नकोस']],
  ["nako", ['नको']],
  ["naka", ['नका']],
  ["hoy", ['होय']],
  ["nah", ['नाही']],
  ["bharata", ['भारता']],
  ["maharashtrat", ['महाराष्ट्रात']],
  ["punyat", ['पुण्यात']],
  ["mumbait", ['मुंबईत']],
  ["nagpur", ['नागपूर']],
  ["nashik", ['नाशिक']],
  ["kolhapur", ['कोल्हापूर']],
  ["satara", ['सातारा']],
  ["sangli", ['सांगली']],
  ["aurangabad", ['औरंगाबाद']],
  ["solapur", ['सोलापूर']],
  ["amravati", ['अमरावती']],
  ["thane", ['ठाणे']],
  ["kalyan", ['कल्याण']],
  ["dhule", ['धुळे']],
  ["jalgaon", ['जळगाव']],
  ["latur", ['लातूर']],
  ["nanded", ['नांदेड']],
  ["chandrapur", ['चंद्रपूर']],
  ["gondia", ['गोंदिया']],
  ["beed", ['बीड']],
  ["deshat", ['देशात']],
  ["gavala", ['गावाला']],
  ["gavat", ['गावात']],
  ["gharat", ['घरात']],
  ["gharala", ['घराला']],
  ["gharche", ['घरचे']],
  ["gharatla", ['घरातला']],
  ["shalet", ['शाळेत']],
  ["shalela", ['शाळेला']],
  ["vidyalaya", ['विद्यालय']],
  ["mahavidyalaya", ['महाविद्यालय']],
  ["school", ['स्कूल']],
  ["office", ['ऑफिस']],
  ["dukanat", ['दुकानात']],
  ["bajar", ['बाजार']],
  ["bazarat", ['बाजारात']],
  ["mandirat", ['मंदिरात']],
  ["masjid", ['मस्जिद']],
  ["church", ['चर्च']],
  ["gurudwara", ['गुरुद्वारा']],
  ["nadit", ['नदीत']],
  ["dongarat", ['डोंगरात']],
  ["samudrat", ['समुद्रात']],
  ["rastyavar", ['रस्त्यावर']],
  ["pulavar", ['पुलावर']],
  ["vimanatala", ['विमानतळ']],
  ["aaji", ['आजी']],
  ["ajoba", ['आजोबा']],
  ["mulanna", ['मुलांना']],
  ["maitrin", ['मैत्रीण']],
  ["manse", ['माणसे']],
  ["lokanna", ['लोकांना']],
  ["manusala", ['माणसाला']],
  ["shikshika", ['शिक्षिका']],
  ["vidyarthini", ['विद्यार्थिनी']],
  ["police", ['पोलीस']],
  ["sainik", ['सैनिक']],
  ["shetkari", ['शेतकरी']],
  ["kisan", ['किसान']],
  ["majur", ['मजूर']],
  ["misal", ['मिसळ']],
  ["pavbhaji", ['पावभाजी']],
  ["coffee", ['कॉफी']],
  ["dudhat", ['दुधात']],
  ["dupar", ['दुपार']],
  ["ratra", ['रात्र']],
  ["divsat", ['दिवसात']],
  ["bara", ['बारा']],
  ["tera", ['तेरा']],
  ["chauda", ['चौदा']],
  ["pandhra", ['पंधरा']],
  ["sola", ['सोळा']],
  ["satra", ['सतरा']],
  ["athra", ['अठरा']],
  ["ekonis", ['एकोणीस']],
  ["vis", ['वीस']],
  ["hajar", ['हजार']],
  ["lakh", ['लाख']],
  ["koti", ['कोटी']],
  ["pahili", ['पहिली']],
  ["pahile", ['पहिले']],
  ["dusra", ['दुसरा']],
  ["dusri", ['दुसरी']],
  ["dusre", ['दुसरे']],
  ["tisra", ['तिसरा']],
  ["keli", ['केली']],
  ["kele", ['केले']],
  ["geli", ['गेली']],
  ["gele", ['गेले']],
  ["aali", ['आली']],
  ["aale", ['आले']],
  ["hoti", ['होती']],
  ["ani", ['आणि']],
  ["parantu", ['परंतु']],
  ["mhanun", ['म्हणून']],
  ["mhanje", ['म्हणजे']],
  ["asi", ['अशी']],
  ["ase", ['असे']],
  ["asha", ['अशा']],
  ["ashe", ['अशे']],
  ["tasi", ['तशी']],
  ["tase", ['तसे']],
  ["tasha", ['तशा']],
  ["jasi", ['जशी']],
  ["jase", ['जसे']],
  ["jasha", ['जशा']],
  ["itki", ['इतकी']],
  ["itke", ['इतके']],
  ["itkya", ['इतक्या']],
  ["titki", ['तितकी']],
  ["titke", ['तितके']],
  ["bhashet", ['भाषेत']],
  ["bhashela", ['भाषेला']],
  ["sanskritit", ['संस्कृतीत']],
  ["itihasat", ['इतिहासात']],
  ["sahityat", ['साहित्यात']],
  ["kathit", ['कथेत']],
  ["kavitet", ['कवितेत']],
  ["geetat", ['गीतात']],
  ["gane", ['गाणे']],
  ["ganyat", ['गाण्यात']],
  ["natakat", ['नाटकात']],
  ["cinema", ['सिनेमा']],
  ["cinemat", ['सिनेमात']],
  ["chitrapat", ['चित्रपट']],
  ["khelat", ['खेळात']],
  ["shikshanat", ['शिक्षणात']],
  ["shikshana", ['शिक्षणा']],
  ["shikshanasathi", ['शिक्षणासाठी']],
  ["nokrit", ['नोकरीत']],
  ["nokrisathi", ['नोकरीसाठी']],
  ["vyavasay", ['व्यवसाय']],
  ["vyavasayat", ['व्यवसायात']],
  ["paisyat", ['पैशात']],
  ["paisa", ['पैसा']],
  ["paishe", ['पैशे']],
  ["velet", ['वेळेत']],
  ["velela", ['वेळेला']],
  ["divsala", ['दिवसाला']],
  ["mahinyat", ['महिन्यात']],
  ["varshat", ['वर्षात']],
  ["varshala", ['वर्षाला']],
  ["aathavadyat", ['आठवड्यात']],
  ["premala", ['प्रेमाला']],
  ["premane", ['प्रेमाने']],
  ["mitravar", ['मित्रावर']],
  ["mitranna", ['मित्रांना']],
  ["kutumbat", ['कुटुंबात']],
  ["kutumbala", ['कुटुंबाला']],
  ["parivarat", ['परिवारात']],
  ["samajat", ['समाजात']],
  ["samajala", ['समाजाला']],
  ["deshala", ['देशाला']],
  ["rajyat", ['राज्यात']],
  ["pahaychi", ['पाहायची']],
  ["pahayche", ['पाहायचे']],
  ["bolaychi", ['बोलायची']],
  ["bolayche", ['बोलायचे']],
  ["lihaychi", ['लिहायची']],
  ["lihayche", ['लिहायचे']],
  ["vachaychi", ['वाचायची']],
  ["vachayche", ['वाचायचे']],
  ["lihayala", ['लिहायला']],
  ["vachayala", ['वाचायला']],
  ["lihun", ['लिहून']],
  ["vachun", ['वाचून']],
  ["dokya", ['डोक्यात']],
  ["haat", ['हात']],
  ["hatat", ['हातात']],
  ["paay", ['पाय']],
  ["payat", ['पायात']],
  ["kaan", ['कान']],
  ["naak", ['नाक']],
  ["tond", ['तोंड']],
  ["gadit", ['गाडीत']],
  ["basmadhye", ['बसमध्ये']],
  ["trainmadhye", ['ट्रेनमध्ये']],
  ["vimanat", ['विमानात']],
  ["anandat", ['आनंदात']],
  ["dukhat", ['दुःखात']],
  ["raag", ['राग']],
  ["raagat", ['रागात']],
  ["shantit", ['शांतीत']],
  ["yashasvi", ['यशस्वी']],
  ["prayatnat", ['प्रयत्नात']],
  ["vishvasat", ['विश्वासात']],
  ["aashet", ['आशेत']],
  ["karanat", ['कारणात']],
  ["jarr", ['जर']],
  ["tarr", ['तर']],
  ["kinva", ['किंवा']],
  ["jevate", ['जेवते']],
  ["jevatat", ['जेवतात']],
  ["jeva", ['जेवा']],
  ["jev", ['जेव']],
  ["pitte", ['पिते']],
  ["pitatat", ['पितात']],
  ["piva", ['पिवा']],
  ["pi", ['पी']],
  ["zopte", ['झोपते']],
  ["zopat", ['झोपतात']],
  ["zopa", ['झोपा']],
  ["zop", ['झोप']],
  ["uthe", ['उठते']],
  ["uthatat", ['उठतात']],
  ["utha", ['उठा']],
  ["uth", ['उठ']],
  ["baste", ['बसते']],
  ["bastat", ['बसतात']],
  ["basa", ['बसा']],
  ["bas", ['बस']],
  ["ubhate", ['उभी राहते']],
  ["chalte", ['चालते']],
  ["chaltat", ['चालतात']],
  ["chala", ['चाला']],
  ["chal", ['चाल']],
  ["palte", ['पळते']],
  ["palatat", ['पळतात']],
  ["pal", ['पळ']],
  ["khelte", ['खेळते']],
  ["khelatat", ['खेळतात']],
  ["khela", ['खेळा']],
  ["gate", ['गाते']],
  ["gatat", ['गातात']],
  ["ga", ['गा']],
  ["gata", ['गाता']],
  ["nachte", ['नाचते']],
  ["nachta", ['नाचतात']],
  ["nacha", ['नाचा']],
  ["nach", ['नाच']],
  ["haste", ['हसते']],
  ["hastat", ['हसतात']],
  ["hasa", ['हसा']],
  ["has", ['हस']],
  ["radte", ['रडते']],
  ["radtat", ['रडतात']],
  ["rada", ['रडा']],
  ["rad", ['रड']],
  ["jevanat", ['जेवणात']],
  ["jevanala", ['जेवणाला']],
  ["panyat", ['पाण्यात']],
  ["panyala", ['पाण्याला']],
  ["bhatat", ['भातात']],
  ["bhajit", ['भाजीत']],
  ["polita", ['पोळीत']],
  ["chapatit", ['चपातीत']],
  ["chahat", ['चहात']],
  ["mahitit", ['माहितीत']],
  ["mahitisathi", ['माहितीसाठी']],
  ["prashnat", ['प्रश्नात']],
  ["prashnala", ['प्रश्नाला']],
  ["uttarat", ['उत्तरात']],
  ["uttarala", ['उत्तराला']],
  ["vicharat", ['विचारात']],
  ["vicharala", ['विचाराला']],
  ["bhavnet", ['भावनेत']],
  ["anubhavat", ['अनुभवात']],
  ["sanskarat", ['संस्कारात']],
  ["paramparat", ['परंपरेत']],
  ["utsavet", ['उत्सवात']],
  ["sanala", ['सणाला']],
  ["divalit", ['दिवाळीत']],
  ["ganpatit", ['गणपतीत']],
  ["dasryat", ['दसऱ्यात']],
  ["holita", ['होळीत']],
  ["rakhila", ['राखीला']],
  ["kana", ['कण', 'काना']],
  ["gani", ['गाणी', 'गणी']],
  ["mani", ['मणी', 'मनी']],
  ["phala", ['फळा', 'फला']],
  ["ghene", ['घेणे', 'घेने']],
  ["varne", ['वरणे', 'वर्ने']],
  ["kharne", ['खरणे', 'खर्ने']],
  ["gharche", ['घरचे']],
  ["shalela", ['शाळेला']],
  ["vidyalaya", ['विद्यालय']],
  ["aabhar", ['आभार']],
  ["abhar", ['आभार']],
  ["tumche", ['तुमचे']],
  ["sagala", ['सगळा']],
  ["bharat", ['भारत']],
  ["maharashtra", ['महाराष्ट्र']],
  ["mumbai", ['मुंबई']],
  ["aahat", ['आहात']],
  ["hava", ['हवा']],
  ["havaa", ['हवा']],
  ["hava", ['हवा']],
  ["karte", ['करते']],
  ["bolte", ['बोलते']],
  ["aikate", ['ऐकते']],
  ["lihite", ['लिहिते']],
  ["dete", ['देते']],
  ["ghete", ['घेते']],
  ["sangte", ['सांगते']],
  ["samajate", ['समजते']],
  ["watte", ['वाटते']],
  ["lagte", ['लागते']],
  ["disate", ['दिसते']],
  ["bhete", ['भेटते']],
  ["dukh", ['दुःख']],
  ["tar", ['तर']],
  ["jeavate", ['जेवते']],
  ["basto", ['बसतो']],
  ["bus", ['बस']],
  ["train", ['ट्रेन']],
  ["jaun", ['जाऊन']],
  ["pahun", ['पाहून']],
  ["nantar", ['नंतर']],
  ["udya", ['उद्या']],
  ["parva", ['परवा']],
  ["ratri", ['रात्री']],
  ["tithe", ['तिथे']],
  ["kuthe", ['कुठे']],
  ["baba", ['बाबा']],
  ["bahin", ['बहीण']],
  ["mulgi", ['मुलगी']],
  ["lok", ['लोक']],
  ["chandra", ['चंद्र']],
  ["unhala", ['उन्हाळा']],
  ["zad", ['झाड']],
  ["don", ['दोन']],
  ["teen", ['तीन']],
  ["pan", ['पण']],
  ["manish", ["मनिष", "मनीष", "मनिश"]],
  ["maneesh", ["मनीष", "मनिष", "मनीश"]],
  ["manisha", ["मनिषा", "मनीषा", "मनिशा"]],
  ["ashish", ["आशिष", "आशीष", "आशिश"]],
  ["piyush", ["पियुष", "पीयुष", "पियुश"]],
  ["ayush", ["आयुष", "आयुश"]],
  ["harsh", ["हर्ष", "हर्श"]],
  ["harshal", ["हर्षल"]],
  ["varsha", ["वर्षा"]],
  ["santosh", ["संतोष", "सन्तोष"]],
  ["subhash", ["सुभाष"]],
  ["suresh", ["सुरेश"]],
  ["ramesh", ["रमेश"]],
  ["mahesh", ["महेश"]],
  ["dinesh", ["दिनेश", "दीनेश"]],
  ["ganesh", ["गणेश", "गनेश"]],
  ["rajesh", ["राजेश"]],
  ["sandesh", ["संदेश"]],
  ["mukesh", ["मुकेश"]],
  ["umesh", ["उमेश"]],
  ["nilesh", ["निलेश", "नीलेश"]],
  ["kamlesh", ["कमलेश"]],
  ["yogesh", ["योगेश"]],
  ["bhavesh", ["भावेश"]],
  ["hitesh", ["हितेश"]],
  ["jitesh", ["जितेश"]],
  ["paresh", ["परेश"]],
  ["naresh", ["नरेश"]],
  ["rakesh", ["राकेश"]],
  ["lokesh", ["लोकेश"]],
  ["jagdish", ["जगदीश", "जगदिश"]],
  ["harish", ["हरीश", "हरिश"]],
  ["girish", ["गिरीश", "गिरिश"]],
  ["satish", ["सतीश", "सतिश"]],
  ["nitish", ["नितीश", "नितिश"]],
  ["prakash", ["प्रकाश"]],
  ["akash", ["आकाश"]],
  ["vikash", ["विकास"]],
  ["vikas", ["विकास"]],
  ["vishal", ["विशाल"]],
  ["prashant", ["प्रशांत"]],
  ["sushant", ["सुशांत"]],
  ["shrikant", ["श्रीकांत"]],
  ["anand", ["आनंद"]],
  ["amit", ["अमित"]],
  ["sumit", ["सुमित"]],
  ["sunil", ["सुनील", "सुनिल"]],
  ["anil", ["अनिल"]],
  ["kasht", ["कष्ट"]],
  ["kashta", ["कष्ट"]],
  ["nasht", ["नष्ट"]],
  ["nashta", ["नाश्ता", "नष्ट"]],
  ["drushti", ["दृष्टी", "दृष्टि"]],
  ["shrushti", ["सृष्टी", "सृष्टि"]],
  ["bhavishya", ["भविष्य"]],
  ["manushya", ["मनुष्य"]],
  ["dhanush", ["धनुष्य", "धनुष"]],
  ["shatkon", ["षट्कोन", "षटकोन"]],
  ["shreshth", ["श्रेष्ठ"]],
  ["jyeshth", ["ज्येष्ठ"]],
  ["kanishth", ["कनिष्ठ"]],
  ["varishth", ["वरिष्ठ"]],
  ["spasht", ["स्पष्ट"]],
  ["spashta", ["स्पष्ट"]],
  ["bhrasht", ["भ्रष्ट"]],
  ["bhrashtachar", ["भ्रष्टाचार"]],
  ["shesh", ["शेष"]],
  ["aakarshan", ["आकर्षण"]],
  ["pariksha", ["परीक्षा", "परिक्षा"]],
  ["shiksha", ["शिक्षा"]],
  ["diksha", ["दीक्षा"]],
  ["raksha", ["रक्षा"]],
  ["lakshman", ["लक्ष्मण"]],
  ["lakshmi", ["लक्ष्मी"]],
  ["lakshya", ["लक्ष्य"]],
  ["india", ["इंडिया", "भारत"]],
  ["indiya", ["इंडिया", "इंदिया", "इन्डिया"]],
  ["nav", ["नाव", "नव"]],
  ["naav", ["नाव"]],
  ["chhan", ["छान"]],
  ["chan", ["छान"]],
  ["lihito", ["लिहितो"]],
  ["lihite", ["लिहिते"]],
  ["tumchya", ["तुमच्या"]],
  ["majhya", ["माझ्या"]],
  ["aamchya", ["आमच्या"]],
  ["tyanchya", ["त्यांच्या"]],
  ["madatibaddal", ["मदतीबद्दल"]],
  ["madat", ["मदत"]],
  ["maharashtrachi", ["महाराष्ट्राची"]],
  ["maharashtrache", ["महाराष्ट्राचे"]],
  ["sanskruti", ["संस्कृती", "संस्कृति", "सांस्कृतिक"]],
  ["sanskriti", ["संस्कृती", "संस्कृति", "सांस्कृतिक"]],
  ["sanskrut", ["संस्कृत"]],
  ["sanskrit", ["संस्कृत"]],
  ["sanskrutik", ["सांस्कृतिक", "संस्कृतिक"]],
  ["sanskritik", ["सांस्कृतिक", "संस्कृतिक"]],
  ["sanskrutit", ["संस्कृतीत"]],
  ["kruti", ["कृती", "कृति"]],
  ["kriti", ["कृती", "कृति"]],
  ["prakruti", ["प्रकृती", "प्रकृति"]],
  ["prakriti", ["प्रकृती", "प्रकृति"]],
  ["vikruti", ["विकृती", "विकृति"]],
  ["aakruti", ["आकृती", "आकृति"]],
  ["akruti", ["आकृती", "अकृती"]],
  ["smruti", ["स्मृती", "स्मृति"]],
  ["smriti", ["स्मृती", "स्मृति"]],
  ["krupa", ["कृपा"]],
  ["krushi", ["कृषी", "कृषि"]],
  ["krushna", ["कृष्ण", "कृष्णा"]],
  ["krishna", ["कृष्ण", "कृष्णा"]],
  ["pruthvi", ["पृथ्वी"]],
  ["prithvi", ["पृथ्वी"]],
  ["hruday", ["हृदय"]],
  ["hriday", ["हृदय"]],
  ["mrutyu", ["मृत्यू", "मृत्यु"]],
  ["amrut", ["अमृत"]],
  ["amrit", ["अमृत"]],
  ["vruksha", ["वृक्ष"]],
  ["vriksha", ["वृक्ष"]],
  ["vrutti", ["वृत्ती", "वृत्ति"]],
  ["pravrutti", ["प्रवृत्ती", "प्रवृत्ति"]],
  ["nivrutti", ["निवृत्ती", "निवृत्ति"]],
  ["gruha", ["गृह"]],
  ["gruhini", ["गृहिणी"]],
  ["trupti", ["तृप्ती", "तृप्ति"]],
  ["trushna", ["तृष्णा"]],
  ["matrubhasha", ["मातृभाषा"]],
  ["netrutva", ["नेतृत्व"]],
  ["kartrutva", ["कर्तृत्व"]],
  ["vaktrutva", ["वक्तृत्व"]],
  ["nrutya", ["नृत्य"]],
  ["rushi", ["ऋषी", "ऋषि"]],
  ["rushikesh", ["ऋषिकेश"]],
  ["rutu", ["ऋतू", "ऋतु"]],
  ["runa", ["ऋण", "रुण"]],
  ["samruddhi", ["समृद्धी", "समृद्धि"]],
  ["samruddha", ["समृद्ध"]],
  ["vruddhi", ["वृद्धी", "वृद्धि"]],
  ["vruddha", ["वृद्ध"]],
  ["anuswar", ["अनुस्वार"]],
  ["anusvar", ["अनुस्वार"]],
  ["anusvaar", ["अनुस्वार"]],
  ["nehmi", ["नेहमी", "नेहमीच"]],
  ["nehami", ["नेहमी", "नेहमीच"]],
  ["nehmich", ["नेहमीच"]],
  ["nehamich", ["नेहमीच"]],
  ["yet", ["येत", "येते", "येतो"]],
  ["naahi", ["नाही", "नाहीत"]],
  ["nahit", ["नाहीत"]],
  ["naahit", ["नाहीत"]],
  ["sansar", ["संसार"]],
  ["sanstha", ["संस्था"]],
  ["sanshodhan", ["संशोधन"]],
  ["sanshay", ["संशय"]],
  ["sansad", ["संसद"]],
  ["sanvad", ["संवाद"]],
  ["samvad", ["संवाद"]],
  ["sanvidhan", ["संविधान"]],
  ["samvidhan", ["संविधान"]],
  ["sanrakshan", ["संरक्षण"]],
  ["samrakshan", ["संरक्षण"]],
  ["sanrachana", ["संरचना"]],
  ["sanlagna", ["संलग्न"]],
  ["sanyam", ["संयम"]],
  ["sanyog", ["संयोग"]],
  ["sanyukta", ["संयुक्त"]],
  ["sanhita", ["संहिता"]],
  ["sanhar", ["संहार"]],
  ["sanmati", ["संमती"]],
  ["sammati", ["संमती"]],
  ["sampurna", ["संपूर्ण"]],
  ["sampark", ["संपर्क"]],
  ["sampatti", ["संपत्ती"]],
  ["sambandh", ["संबंध"]],
  ["sankalp", ["संकल्प"]],
  ["sankat", ["संकट"]],
  ["sanket", ["संकेत"]],
  ["sankhya", ["संख्या"]],
  ["sankshipta", ["संक्षिप्त"]],
  ["sandnya", ["संज्ञा"]],
  ["sangeet", ["संगीत"]],
  ["sangit", ["संगीत"]],
  ["sanganak", ["संगणक"]],
  ["sangharsh", ["संघर्ष"]],
  ["sangh", ["संघ"]],
  ["sanghatana", ["संघटना"]],
  ["sangrah", ["संग्रह"]],
  ["sangam", ["संगम"]],
  ["prasang", ["प्रसंग"]],
  ["abhang", ["अभंग"]],
  ["pandurang", ["पांडुरंग"]],
  ["pandharpur", ["पंढरपूर"]],
  ["mangal", ["मंगळ", "मंगल"]],
  ["mangalwar", ["मंगळवार"]],
  ["mangesh", ["मंगेश"]],
  ["rang", ["रंग", "रांग"]],
  ["rangoli", ["रांगोळी"]],
  ["ganga", ["गंगा"]],
  ["tiranga", ["तिरंगा"]],
  ["danga", ["दंगा"]],
  ["bangla", ["बंगला"]],
  ["ang", ["अंग"]],
  ["angan", ["अंगण"]],
  ["anghol", ["आंघोळ", "अंघोळ"]],
  ["sinha", ["सिंह"]],
  ["simha", ["सिंह"]],
  ["vansh", ["वंश"]],
  ["ansh", ["अंश"]],
  ["hans", ["हंस"]],
  ["hinsa", ["हिंसा"]],
  ["ahinsa", ["अहिंसा"]],
  ["prashansa", ["प्रशंसा"]],
  ["kanda", ["कांदा", "कंद"]],
  ["thamba", ["थांबा"]],
  ["thamb", ["थांब"]],
  ["lamba", ["लांब", "लंबा"]],
  ["lamb", ["लांब", "लंब"]],
  ["tamba", ["तांबा"]],
  ["tambda", ["तांबडा"]],
  ["amba", ["आंबा", "अंबा"]],
  ["ambedkar", ["आंबेडकर"]],
  ["chandi", ["चांदी"]],
  ["bhande", ["भांडे"]],
  ["bhandi", ["भांडी"]],
  ["bhandan", ["भांडण"]],
  ["mandi", ["मांडी", "मंडी"]],
  ["dandi", ["दांडी"]],
  ["phandi", ["फांदी"]],
  ["khanda", ["खांदा", "खंड"]],
  ["gandhi", ["गांधी"]],
  ["chandoba", ["चांदोबा"]],
  ["chandani", ["चांदणी"]],
  ["pandhara", ["पांढरा"]],
  ["pandhri", ["पांढरी"]],
  ["pandhre", ["पांढरे"]],
  ["bandh", ["बांध", "बंध"]],
  ["bandhkam", ["बांधकाम"]],
  ["kranti", ["क्रांती"]],
  ["prant", ["प्रांत"]],
  ["shant", ["शांत", "शांतता"]],
  ["shantata", ["शांतता"]],
  ["tyanna", ["त्यांना"]],
  ["tyana", ["त्यांना", "त्याना"]],
  ["yanna", ["यांना"]],
  ["yana", ["यांना", "याना"]],
  ["jyanna", ["ज्यांना"]],
  ["jyana", ["ज्यांना"]],
  ["sarvanna", ["सर्वांना"]],
  ["sarvana", ["सर्वांना"]],
  ["saglyanna", ["सगळ्यांना"]],
  ["saglyana", ["सगळ्यांना"]],
  ["mulana", ["मुलांना", "मुलाना"]],
  ["lokana", ["लोकांना", "लोकाना"]],
  ["mitrana", ["मित्रांना", "मित्राना"]],
  ["tyancha", ["त्यांचा", "त्यांचं"]],
  ["tyanchi", ["त्यांची"]],
  ["tyanche", ["त्यांचे"]],
  ["yancha", ["यांचा", "यांचं"]],
  ["yanchi", ["यांची"]],
  ["yanche", ["यांचे"]],
  ["yanchya", ["यांच्या"]],
  ["sarvancha", ["सर्वांचा", "सर्वांचं"]],
  ["sarvanchi", ["सर्वांची"]],
  ["sarvanche", ["सर्वांचे"]],
  ["sarvanchya", ["सर्वांच्या"]],
  ["lokancha", ["लोकांचा"]],
  ["lokanchi", ["लोकांची"]],
  ["lokanche", ["लोकांचे"]],
  ["lokanchya", ["लोकांच्या"]],
  ["mulancha", ["मुलांचा"]],
  ["mulanchi", ["मुलांची"]],
  ["mulanche", ["मुलांचे"]],
  ["mulanchya", ["मुलांच्या"]],
  ["apla", ["आपला", "आपलं", "आपले", "आपली"]],
  ["aapla", ["आपला", "आपलं", "आपले", "आपली"]],
  ["apli", ["आपली"]],
  ["aapli", ["आपली"]],
  ["aple", ["आपले"]],
  ["aaple", ["आपले"]],
  ["aapan", ["आपण"]],
  ["apan", ["आपण"]],
  ["vegla", ["वेगळा", "वेगळं", "वेगळे", "वेगळी"]],
  ["vegli", ["वेगळी"]],
  ["vegle", ["वेगळे"]],
  ["khara", ["खरा", "खरं", "खरे", "खरी"]],
  ["khari", ["खरी"]],
  ["khare", ["खरे"]],
  ["khota", ["खोटा", "खोटं", "खोटे", "खोटी"]],
];

function buildMergedDict(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const [key, vals] of [...DICT_ENTRIES, ...EXTRA_DICT_ENTRIES]) {
    const k = key.toLowerCase();
    if (!map[k]) {
      map[k] = [...vals];
    } else {
      for (const v of vals) {
        if (!map[k].includes(v)) map[k].push(v);
      }
    }
  }
  return map;
}

export const MARATHI_DICT: Record<string, string[]> = buildMergedDict();

const CUSTOM_DICT_KEY = "marathi_typing_custom_dict_v1";

let customDictCache: Record<string, string> | null = null;

export function getCustomDictionary(): Record<string, string> {
  if (customDictCache) return customDictCache;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(CUSTOM_DICT_KEY) : null;
    customDictCache = raw ? JSON.parse(raw) : {};
  } catch {
    customDictCache = {};
  }
  return customDictCache!;
}

export function addCustomWord(romanRaw: string, marathiWord: string): Record<string, string> {
  const key = romanRaw.toLowerCase().replace(/[^a-z]/g, "");
  const val = marathiWord.trim();
  if (!key || !val) return getCustomDictionary();
  const next = { ...getCustomDictionary(), [key]: val };
  customDictCache = next;
  try {
    localStorage.setItem(CUSTOM_DICT_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function removeCustomWord(romanRaw: string): Record<string, string> {
  const key = romanRaw.toLowerCase().replace(/[^a-z]/g, "");
  const next = { ...getCustomDictionary() };
  delete next[key];
  customDictCache = next;
  try {
    localStorage.setItem(CUSTOM_DICT_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

/**
 * Computes Marathi oblique forms (सामान्यरूप) of a Devanagari noun/pronoun stem
 * before attaching postpositions like -ला, -चा, -साठी, -मध्ये, -वर, -पासून, etc.
 */
function toMarathiObliqueForms(devStem: string): string[] {
  const forms = new Set<string>();
  // Special irregular oblique stems in Marathi
  const irregulars: Record<string, string[]> = {
    "मी": ["माझ्या", "मज"],
    "तू": ["तुझ्या", "तुज"],
    "तो": ["त्या"],
    "ती": ["ति"],
    "ते": ["त्या"],
    "हा": ["ह्या", "या"],
    "ही": ["हि", "या"],
    "हे": ["ह्या", "या"],
    "कोण": ["कोणा", "कुणा"],
    "आपण": ["आपल्या"],
    "आम्ही": ["आमच्या", "आम्हा"],
    "तुम्ही": ["तुमच्या", "तुम्हा"],
    "पाणी": ["पाण्या"],
    "शाळा": ["शाळे"],
    "भाषा": ["भाषे"],
    "दिशा": ["दिशे"],
    "कथा": ["कथे"],
    "कविता": ["कविते"],
    "माती": ["माती"],
    "शेती": ["शेती"],
    "नदी": ["नदी"],
    "गाडी": ["गाडी", "गाड्या"],
    "मुलगा": ["मुला"],
    "मुलगी": ["मुली"],
    "माणूस": ["माणसा"],
    "पाऊस": ["पावसा"],
    "गाव": ["गावा"],
    "नाव": ["नावा"],
    "घर": ["घरा"],
    "काम": ["कामा"],
    "देश": ["देशा"],
    "मित्र": ["मित्रा"],
    "दिवस": ["दिवसा"],
    "महिना": ["महिन्या"],
    "आठवडा": ["आठवड्या"],
    "रस्ता": ["रस्त्या"],
    "पैसे": ["पैशा"],
    "डोळे": ["डोळ्या"],
    "कांदा": ["कांद्या"],
  };
  if (irregulars[devStem]) {
    for (const f of irregulars[devStem]) forms.add(f);
  }
  if (devStem.endsWith("्या")) {
    // Already in oblique -्या form (e.g. माझ्या, तुमच्या, आमच्या, त्यांच्या, चांगल्या)
    forms.add(devStem);
  } else if (devStem.endsWith("ा")) {
    // Masculine -ा -> -्या (मुलगा -> मुला, महिना -> महिन्या), Feminine -ा -> -े (शाळा -> शाळे)
    forms.add(devStem.slice(0, -1) + "्या");
    forms.add(devStem.slice(0, -1) + "े");
    forms.add(devStem);
  } else if (devStem.endsWith("ी")) {
    forms.add(devStem);
    forms.add(devStem.slice(0, -1) + "्या");
  } else if (devStem.endsWith("ू")) {
    forms.add(devStem);
    forms.add(devStem.slice(0, -1) + "वा");
  } else if (devStem.endsWith("े")) {
    forms.add(devStem.slice(0, -1) + "्या");
    forms.add(devStem);
  } else if (!/[ािीुूृेैोौ्ंः]$/.test(devStem)) {
    // Consonant/inherent-a ending -> + ा (घर -> घरा, मित्र -> मित्रा, पुस्तक -> पुस्तका) and bare stem (आज -> आज)
    forms.add(devStem + "ा");
    forms.add(devStem + "े");
    forms.add(devStem);
  } else {
    forms.add(devStem);
  }
  return Array.from(forms);
}

function resolveMorphologicalCandidates(word: string): string[] {
  if (word.length < 5) return [];
  const results: string[] = [];
  for (const rule of MARATHI_SUFFIX_RULES) {
    if (!word.endsWith(rule.romanSuffix)) continue;
    const rawStem = word.slice(0, word.length - rule.romanSuffix.length);
    if (rawStem.length < 2) continue;

    // Candidate roman stems to check in dictionary:
    // e.g. "ghara" + "sathi" -> check "ghara" and "ghar"
    // e.g. "mahinya" + "madhye" -> check "mahinya", "mahina"
    const stemCandidates = [rawStem];
    if (rawStem.endsWith("a") && rawStem.length >= 3) {
      stemCandidates.push(rawStem.slice(0, -1));
    }
    if (rawStem.endsWith("ya") && rawStem.length >= 4) {
      stemCandidates.push(rawStem.slice(0, -2) + "a");
      stemCandidates.push(rawStem.slice(0, -2) + "i");
    }
    if (rawStem.endsWith("e") && rawStem.length >= 4) {
      stemCandidates.push(rawStem.slice(0, -1) + "a");
      stemCandidates.push(rawStem.slice(0, -1));
    }

    for (const st of stemCandidates) {
      const custom = getCustomDictionary()[st];
      const dictEntries = custom ? [custom, ...(MARATHI_DICT[st] ?? [])] : MARATHI_DICT[st];
      if (dictEntries && dictEntries.length) {
        const baseDev = dictEntries[0];
        if (!rule.needsOblique || rule.devSuffix.startsWith("ां")) {
          // If suffix already starts with ां (like -ांसाठी), strip final ा/े/ी if needed and attach
          const stripped = baseDev.replace(/[ाे]$/, "");
          const combined = rule.devSuffix.startsWith("ां") ? stripped + rule.devSuffix : baseDev + rule.devSuffix;
          if (!results.includes(combined)) results.push(combined);
        } else {
          // If rawStem already ended with 'a' (like gharasathi -> rawStem 'ghara'), prefer the -ा oblique form first
          const obliques = toMarathiObliqueForms(baseDev);
          for (const ob of obliques) {
            const combined = ob + rule.devSuffix;
            if (!results.includes(combined)) results.push(combined);
          }
        }
      }
    }
    if (results.length >= 4) break;
  }
  return results;
}

// --- Phonetic engine ---

const CONSONANTS: [string, string][] = [
  ["chh", "छ"], ["ksh", "क्ष"], ["gy", "ज्ञ"], ["dny", "ज्ञ"], ["jn", "ज्ञ"], ["shr", "श्र"], ["tr", "त्र"],
  ["shth", "ष्ठ"], ["sht", "ष्ट"], ["shh", "ष"],
  ["kh", "ख"], ["gh", "घ"], ["ch", "च"], ["jh", "झ"],
  ["th", "थ"], ["dh", "ध"], ["ph", "फ"], ["bh", "भ"], ["sh", "श"], ["zh", "झ"],
  ["k", "क"], ["g", "ग"], ["j", "ज"], ["t", "त"], ["d", "द"], ["n", "न"],
  ["p", "प"], ["f", "फ"], ["b", "ब"], ["m", "म"], ["y", "य"], ["r", "र"],
  ["l", "ल"], ["v", "व"], ["w", "व"], ["s", "स"], ["h", "ह"], ["q", "क"],
  ["z", "झ"], ["c", "च"], ["x", "क्स"],
];

const VOWELS: [string, string, string][] = [
  // roman, matra (after consonant), independent
  ["aa", "ा", "आ"], ["ai", "ै", "ऐ"], ["au", "ौ", "औ"], ["ou", "ौ", "औ"], ["ei", "ै", "ऐ"],
  ["ee", "ी", "ई"], ["ii", "ी", "ई"], ["oo", "ू", "ऊ"],
  ["a", "", "अ"], ["i", "ि", "इ"], ["u", "ु", "उ"], ["e", "े", "ए"], ["o", "ो", "ओ"],
];

function matchConsonant(s: string, i: number): [string, string, number] | null {
  for (const [rom, dev] of CONSONANTS) {
    if (s.startsWith(rom, i)) return [rom, dev, rom.length];
  }
  return null;
}
function matchVowel(s: string, i: number): [string, string, string, number] | null {
  for (const [rom, matra, indep] of VOWELS) {
    if (s.startsWith(rom, i)) return [rom, matra, indep, rom.length];
  }
  return null;
}

type Token = { type: "C" | "V"; rom: string; dev: string; matra?: string; indep?: string };

function tokenize(word: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < word.length) {
    const c = matchConsonant(word, i);
    const v = matchVowel(word, i);
    // Prefer longer match; consonants like "ch" vs vowel "a" don't overlap much, but "a" vs consonant start distinct.
    // If both match, prefer longer roman length.
    if (c && v) {
      if (c[2] >= v[3]) { tokens.push({ type: "C", rom: c[0], dev: c[1] }); i += c[2]; }
      else { tokens.push({ type: "V", rom: v[0], dev: v[2], matra: v[1], indep: v[2] }); i += v[3]; }
    } else if (c) { tokens.push({ type: "C", rom: c[0], dev: c[1] }); i += c[2]; }
    else if (v) { tokens.push({ type: "V", rom: v[0], dev: v[2], matra: v[1], indep: v[2] }); i += v[3]; }
    else { i++; } // skip unknown char
  }
  return tokens;
}

export function transliterateWordRule(romanRaw: string): string {
  // Support explicit uppercase 'M' as anusvara before lowercasing
  const normalizedRaw = romanRaw.replace(/M/g, "ं");
  const word = romanRaw.toLowerCase().replace(/[^a-z]/g, "");
  if (!word) return romanRaw;
  const tokens = tokenize(word);
  if (tokens.length === 0) return romanRaw;

  let out = "";
  let idx = 0;
  while (idx < tokens.length) {
    const tok = tokens[idx];
    if (tok.type === "V") {
      out += tok.indep!;
      idx++;
    } else {
      // Collect consonant cluster until vowel or end
      const cluster: Token[] = [];
      while (idx < tokens.length && tokens[idx].type === "C") { cluster.push(tokens[idx]); idx++; }
      let vowel: Token | null = null;
      if (idx < tokens.length && tokens[idx].type === "V") { vowel = tokens[idx]; idx++; }

      if (cluster.length === 1) {
        const c = cluster[0];
        if (vowel) {
          // 'a' matra is empty (inherent a) -> just consonant
          out += c.dev + (vowel.matra ?? "");
        } else {
          // word-final consonant: inherent a (e.g., भारत, नमस्कार final र)
          out += c.dev;
        }
      } else {
        // Multiple consonants: all but last get halant, last gets vowel (or inherent a)
        for (let k = 0; k < cluster.length - 1; k++) {
          out += cluster[k].dev + "्";
        }
        const last = cluster[cluster.length - 1];
        if (vowel) out += last.dev + (vowel.matra ?? "");
        else out += last.dev;
      }
    }
  }

  // 1. Marathi 'ru' -> 'ृ' matra (e.g. sanskruti -> संस्कृती, kruti -> कृती, pruthvi -> पृथ्वी, hruday -> हृदय)
  out = out.replace(/([कगदतधनपबभमवसह])्रु/g, "$1ृ");

  // 2. Standard Marathi orthography: nasal before stops & sibilants uses anusvara (ं)
  out = out.replace(/[ङञणनम]्(?=[कखगघचछजझटठडढतथदधपफबभशषस])/g, "ं");
  // Prefix/common syllables (सं-, सिं-, किं-, कुं-, मां-, कां-) before व, र, ल, य, ह, म use anusvara (संवाद, संरक्षण, संयम, संहिता, सिंह, किंवा)
  out = out.replace(/^(स|सा|सि|कि|कु|पु|अ|मा|का)[ङञणनम]्(?=[वरलयहम])/g, "$1ं");

  // 3. Marathi oblique plural & dative suffixes (-ांना, -ींना, -ूंना, -ांचा, -ांची, -ांचे, -ांच्या, -ांसाठी, -ांवर, -ांमध्ये)
  if (word.length > 4 && !["anna", "panna", "channa", "khanna", "manna"].includes(word)) {
    if (word.endsWith("anna")) {
      out = out.replace(/न्ना?$/, "ांना");
    } else if (word.endsWith("inna")) {
      out = out.replace(/[िी]न्ना?$/, "ींना");
    } else if (word.endsWith("unna")) {
      out = out.replace(/[ुू]न्ना?$/, "ूंना");
    }
  }
  if (/a[nm](cha|chi|che|chya|sathi|var|madhye|madhe|kadun|pasun|baddal|sobat|pudhe|mage|peksha|vishayi)$/.test(word)) {
    out = out.replace(/([क-हय])ं(च[ािीे]?|च्या|साठी|सथि|वर|मध्ये|मधे|कडून|कुन|पासून|पसुन|बद्दल|सोबत|पुढे|मागे|पेक्षा|विषयी)$/, "$1ां$2");
    if (word.endsWith("ancha") && out.endsWith("ांच")) out += "ा";
  }
  if (/i[nm](cha|chi|che|chya|sathi|var|madhye|madhe|kadun|pasun|baddal|sobat)$/.test(word)) {
    out = out.replace(/िं(च[ािीे]?|च्या|साठी|सथि|वर|मध्ये|मधे|कडून|पासून|बद्दल|सोबत)$/, "ीं$1");
    if (word.endsWith("incha") && out.endsWith("ींच")) out += "ा";
  }

  // 4. Medial schwa preservation before Marathi suffixes (-ला/-ली/-ले/-लो, -चा/-ची/-चे/-च्या, -तो/-तात) and ह्मि -> हमी (नेहमी)
  out = out.replace(/ह्(म[िी])/g, "ह$1");
  if (word.length >= 5) {
    if (/[^l]la$/.test(word) && out.endsWith("ल")) {
      out = out.replace(/([क-ह])्ल$/, "$1ला");
    }
    out = out.replace(/([क-ह])्(ल[ािीेो]|ल्या)$/, (m, c1, sfx) => (c1 === "ल" ? m : c1 + sfx));
    if (/cha$/.test(word) && out.endsWith("च")) {
      out = out.replace(/([क-ह])्च$/, "$1चा");
    }
    out = out.replace(/([क-ह])्(च[ािीेो]?|च्या)$/, (m, c1, sfx) => (c1 === "श" || c1 === "ष" || c1 === "च" ? m : c1 + sfx));
    out = out.replace(/([क-ह])्(तो|तात|तोस|तेस)$/, "$1$2");
  }

  // 5. Marathi Shuddhalekhan Rule 1: Word-final -i is long ी (संस्कृती, कृती, भक्ती, शक्ती, नेहमी, माहिती)
  if (word.length > 2 && word.endsWith("i") && !word.endsWith("ai") && !word.endsWith("ei") && out.endsWith("ि")) {
    out = out.slice(0, -1) + "ी";
  }

  // Common postposition suffix -sathi -> -साठी (e.g. lokansathi -> लोकांसाठी, deshasathi -> देशासाठी)
  if (word.length > 5 && word.endsWith("sathi")) {
    out = out.replace(/स[थठ][िी]$/, "साठी");
    out = out.replace(/([क-हय])ं(साठी)$/, "$1ां$2");
  }

  // 6. If user explicitly typed uppercase 'M' at the end, convert final म to ं
  if (normalizedRaw.endsWith("ं") && out.endsWith("म")) {
    out = out.slice(0, -1) + "ं";
  }

  return out;
}

function generateVariants(roman: string, base: string): string[] {
  const variants = new Set<string>([base]);
  // Final -a ambiguity: roman ending in "a" maps to ा (मला, हवा, कळा, शाळा, राजा) and neuter/anusvara ं (असं, कसं, बरं, घरं)
  if (roman.endsWith("a") && !base.endsWith("ा") && !base.endsWith("्")) {
    variants.add(base + "ा");
    if (!base.endsWith("ं")) variants.add(base + "ं");
  }
  if (base.endsWith("ा")) {
    variants.add(base.slice(0, -1) + "ं");
  }
  // Dative plural -ana -> -ांना (e.g. mulana -> मुलांना, lokana -> लोकांना, mitrana -> मित्रांना)
  if (roman.endsWith("ana") && roman.length >= 5 && !base.endsWith("ांना")) {
    variants.add(base.replace(/न(ा)?$/, "ांना"));
  }
  // Anusvara variant: if ends with m or n
  if (roman.endsWith("m") && base.endsWith("म")) {
    variants.add(base.slice(0, -1) + "ं");
  }
  if (roman.endsWith("n") && (base.endsWith("न") || base.endsWith("ण"))) {
    variants.add(base.slice(0, -1) + "ं");
  }

  // Systematic consonant & vowel replacements (ordered by relevance in Marathi typing)
  const transforms: [RegExp, string][] = [
    [/[ङञणनम]्(?=[क-ह])/g, "ं"],
    [/([कगदतधनपबभमवसह])्रु/g, "$1ृ"],
    [/([कगदतधनपबभमवसह])्रि/g, "$1ृ"],
    [/([क-ह])ं(?=[क-ह])/g, "$1ां"],
    [/^अं/, "आं"],
    [/^रु/, "ऋ"],
    [/^रि/, "ऋ"],
    [/श/g, "ष"],
    [/ष/g, "श"],
    [/ी/g, "ि"],
    [/ि/g, "ी"],
    [/ु/g, "ू"],
    [/ू/g, "ु"],
    [/ल/g, "ळ"],
    [/न/g, "ण"],
    [/द/g, "ड"],
    [/त/g, "ट"],
    [/थ/g, "ठ"],
    [/ध/g, "ढ"],
    [/([कगदतधनपबभमवसह])ृ/g, "$1्रु"],
  ];

  // First pass: direct single-step transforms on base & initial variants (ensures high-priority transforms aren't pushed out)
  const seedVariants = Array.from(variants);
  for (const [pattern, rep] of transforms) {
    for (const v of seedVariants) {
      if (pattern.test(v)) {
        variants.add(v.replace(pattern, rep));
      }
    }
  }

  // Second pass: combined transforms (e.g. ृ + ी, or ं + ळ/ण/ड)
  const firstPassVariants = Array.from(variants).slice(0, 12);
  for (const [pattern, rep] of transforms.slice(0, 14)) {
    for (const v of firstPassVariants) {
      if (pattern.test(v)) {
        variants.add(v.replace(pattern, rep));
      }
    }
  }

  // Remove base duplicates, keep order: base first, then variants
  const arr = [base, ...Array.from(variants).filter((v) => v !== base)];
  return arr.slice(0, 7);
}

export function getCandidates(romanRaw: string): { candidates: string[]; isEnglish: boolean; isDictionary: boolean } {
  const word = romanRaw.toLowerCase().replace(/[^a-z]/g, "");
  if (!word) return { candidates: [], isEnglish: false, isDictionary: false };

  const customWord = getCustomDictionary()[word];
  const morphCandidates = resolveMorphologicalCandidates(word);

  // Handle neuter/anusvara form typed with trailing -n or -m on a dictionary -a word (e.g., majhan -> माझं, changlan -> चांगलं, kasan -> कसं)
  if (word.length >= 4 && (word.endsWith("an") || word.endsWith("am")) && !MARATHI_DICT[word] && !customWord) {
    const stem = word.slice(0, -1); // ends with 'a'
    const stemDict = MARATHI_DICT[stem];
    if (stemDict && stemDict.length && stemDict[0].endsWith("ा")) {
      const anusvaraForm = stemDict[0].slice(0, -1) + "ं";
      const rule = transliterateWordRule(romanRaw);
      const merged = [anusvaraForm, ...stemDict, ...morphCandidates];
      for (const v of generateVariants(word, rule)) if (!merged.includes(v)) merged.push(v);
      return { candidates: merged.slice(0, 7), isEnglish: false, isDictionary: true };
    }
  }

  const dict = MARATHI_DICT[word];
  if (customWord || (dict && dict.length)) {
    const rule = transliterateWordRule(romanRaw);
    const merged: string[] = [];
    if (customWord) merged.push(customWord);
    if (dict) {
      for (const d of dict) if (!merged.includes(d)) merged.push(d);
    }
    if (merged[0]?.endsWith("ा")) {
      const neuterForm = merged[0].slice(0, -1) + "ं";
      if (!merged.includes(neuterForm)) merged.push(neuterForm);
    }
    for (const m of morphCandidates) if (!merged.includes(m)) merged.push(m);
    if (!merged.includes(rule)) merged.push(rule);
    for (const v of generateVariants(word, merged[0])) if (!merged.includes(v)) merged.push(v);
    for (const v of generateVariants(word, rule)) if (!merged.includes(v)) merged.push(v);
    return { candidates: merged.slice(0, 7), isEnglish: false, isDictionary: true };
  }

  if (morphCandidates.length > 0) {
    const rule = transliterateWordRule(romanRaw);
    const merged = [...morphCandidates];
    if (!merged.includes(rule)) merged.push(rule);
    for (const v of generateVariants(word, morphCandidates[0])) if (!merged.includes(v)) merged.push(v);
    for (const v of generateVariants(word, rule)) if (!merged.includes(v)) merged.push(v);
    return { candidates: merged.slice(0, 7), isEnglish: false, isDictionary: true };
  }

  if (ENGLISH_WORDS.has(word)) return { candidates: [], isEnglish: true, isDictionary: false };
  const rule = transliterateWordRule(romanRaw);
  const cands = generateVariants(word, rule);
  return { candidates: cands.slice(0, 7), isEnglish: false, isDictionary: false };
}

const EN_TO_MR_DIGITS: Record<string, string> = {
  "0": "०", "1": "१", "2": "२", "3": "३", "4": "४",
  "5": "५", "6": "६", "7": "७", "8": "८", "9": "९",
};
const MR_TO_EN_DIGITS: Record<string, string> = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

export function convertNumbersToMarathi(text: string): string {
  return text.replace(/[0-9]/g, (d) => EN_TO_MR_DIGITS[d] ?? d);
}

export function convertNumbersToEnglish(text: string): string {
  return text.replace(/[०-९]/g, (d) => MR_TO_EN_DIGITS[d] ?? d);
}

export function transliterateWord(romanRaw: string): string {
  const { candidates, isEnglish } = getCandidates(romanRaw);
  if (isEnglish) return romanRaw;
  return candidates[0] ?? romanRaw;
}

export function isEnglishWord(romanRaw: string): boolean {
  const w = romanRaw.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return false;
  if (MARATHI_DICT[w]) return false;
  return ENGLISH_WORDS.has(w);
}

/** Transliterate a full sentence preserving spaces/punctuation/numbers/newlines. Only converts roman words not in English list. */
export function transliterateText(input: string): string {
  return input.replace(/[A-Za-z]+/g, (w) => {
    if (isEnglishWord(w)) return w;
    return transliterateWord(w);
  });
}

export function normalizeMarathi(text: string): string {
  return text.normalize("NFC");
}
