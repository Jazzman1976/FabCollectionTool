using System.Globalization;
using System.Text;

namespace FabCollectionTool.Extensions
{
    public static class StringExtensions
    {
        public static string? RemoveDoubleWhitespaces(this string? str)
        {
            if (str == null) return str;
            while (str.Contains("  "))
            {
                str = str.Replace("  ", " ");
            }
            return str;
        }

        public static string? RemoveSpecialCharacters(this string? str)
        {
            if (str == null) return str;
            StringBuilder sb = new StringBuilder();
            foreach (char c in str)
            {
                if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c == ' ' || c == '.' || c == '_' || c == '-' || c == '|')
                {
                    sb.Append(c);
                }
            }
            return sb.ToString();
        }

        public static string? RemoveAccents(this string? text)
        {
            if (text == null) return text;
            StringBuilder sbReturn = new();
            var arrayText = text.Normalize(NormalizationForm.FormD).ToCharArray();
            foreach (char letter in arrayText)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(letter) != UnicodeCategory.NonSpacingMark)
                    sbReturn.Append(letter);
            }
            return sbReturn.ToString();
        }
    }
}
