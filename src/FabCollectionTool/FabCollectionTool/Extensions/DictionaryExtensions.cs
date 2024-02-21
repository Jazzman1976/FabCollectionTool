namespace FabCollectionTool.Extensions
{
    public static class DictionaryExtensions
    {
        public static string GetStringValue(this Dictionary<int, string> dic, int i)
        {
            return dic.ContainsKey(i)
                ? dic[i] ?? ""
                : "";
        }

        public static int GetIntegerValue(this Dictionary<int, string> dic, int i)
        {
            return dic.ContainsKey(i)
                ? int.TryParse(dic[i], out int parsed)
                    ? parsed
                    : 0
                : 0;
        }
    }
}
