//! Humanhash adopted and ported to Rust from https://github.com/zacharyvoase/humanhash
//!
//! There is also a crate that adopts humanhash (https://github.com/jamesmunns/human-hash-rs),
//! but I don't need UUID support.

#[rustfmt::skip]
const DEFAULT_WORDLIST: &[&str] = &[
    "ack", "alabama", "alanine", "alaska", "alpha", "angel", "apart", "april",
    "arizona", "arkansas", "artist", "asparagus", "aspen", "august", "autumn",
    "avocado", "bacon", "bakerloo", "batman", "beer", "berlin", "beryllium",
    "black", "blossom", "blue", "bluebird", "bravo", "bulldog", "burger",
    "butter", "california", "carbon", "cardinal", "carolina", "carpet", "cat",
    "ceiling", "charlie", "chicken", "coffee", "cola", "cold", "colorado",
    "comet", "connecticut", "crazy", "cup", "dakota", "december", "delaware",
    "delta", "diet", "don", "double", "early", "earth", "east", "echo",
    "edward", "eight", "eighteen", "eleven", "emma", "enemy", "equal",
    "failed", "fanta", "fifteen", "fillet", "finch", "fish", "five", "fix",
    "floor", "florida", "football", "four", "fourteen", "foxtrot", "freddie",
    "friend", "fruit", "gee", "georgia", "glucose", "golf", "green", "grey",
    "hamper", "happy", "harry", "hawaii", "helium", "high", "hot", "hotel",
    "hydrogen", "idaho", "illinois", "india", "indigo", "ink", "iowa",
    "island", "item", "jersey", "jig", "johnny", "juliet", "july", "jupiter",
    "kansas", "kentucky", "kilo", "king", "kitten", "lactose", "lake", "lamp",
    "lemon", "leopard", "lima", "lion", "lithium", "london", "louisiana",
    "low", "magazine", "magnesium", "maine", "mango", "march", "mars",
    "maryland", "massachusetts", "may", "mexico", "michigan", "mike",
    "minnesota", "mirror", "mississippi", "missouri", "mobile", "mockingbird",
    "monkey", "montana", "moon", "mountain", "muppet", "music", "nebraska",
    "neptune", "network", "nevada", "nine", "nineteen", "nitrogen", "north",
    "november", "nuts", "october", "ohio", "oklahoma", "one", "orange",
    "oranges", "oregon", "oscar", "oven", "oxygen", "papa", "paris", "pasta",
    "pennsylvania", "pip", "pizza", "pluto", "potato", "princess", "purple",
    "quebec", "queen", "quiet", "red", "river", "robert", "robin", "romeo",
    "rugby", "sad", "salami", "saturn", "september", "seven", "seventeen",
    "shade", "sierra", "single", "sink", "six", "sixteen", "skylark", "snake",
    "social", "sodium", "solar", "south", "spaghetti", "speaker", "spring",
    "stairway", "steak", "stream", "summer", "sweet", "table", "tango", "ten",
    "tennessee", "tennis", "texas", "thirteen", "three", "timing", "triple",
    "twelve", "twenty", "two", "uncle", "undress", "uniform", "uranus", "utah",
    "vegan", "venus", "vermont", "victor", "video", "violet", "virginia",
    "washington", "west", "whiskey", "white", "william", "winner", "winter",
    "wisconsin", "wolfram", "wyoming", "xray", "yankee", "yellow", "zebra",
    "zulu"];

pub fn human_hash(bytes: &[u8], words: usize, separator: &str) -> anyhow::Result<String> {
    let compressed = compress(bytes, words)?;

    Ok(compressed
        .map(|byte| DEFAULT_WORDLIST[byte as usize])
        .fold("".to_owned(), |acc, s| {
            if acc.is_empty() {
                s.to_owned()
            } else {
                acc + separator + s
            }
        }))
}

/// Compress a list of byte values to a fixed target length.
///
/// ```
/// let bytes: &[u8; _] = &[96, 173, 141, 13, 135, 27, 96, 149, 128, 130, 151];
/// assert_eq!(compress(bytes, 4), [205, 128, 156, 96]);
/// ```
///
/// Attempting to compress a smaller number of bytes to a larger number is
/// an error:
///
/// ```
/// let compressed = HumanHasher.compress(bytes, 15);
/// assert!(compressed.is_err());
/// ```
fn compress<'a>(bytes: &'a [u8], target: usize) -> anyhow::Result<impl Iterator<Item = u8> + 'a> {
    let length = bytes.len();
    if target > length {
        return Err(anyhow::anyhow!("Fewer input bytes than requested output"));
    }

    // Split `bytes` into `target` segments.
    let seg_size = length / target;
    let segments = bytes.chunks(seg_size);

    // # Use a simple XOR checksum-like function for compression.
    let checksums = segments.map(|bytes| bytes.iter().fold(0, |acc, cur| acc ^ cur));
    Ok(checksums)
}
